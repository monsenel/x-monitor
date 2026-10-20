import type { DataProvider, FetchResult, HealthCheckResult, NormalizedPost, NormalizedUser, ProviderUsage, SourceEntity } from './types.ts';
import { db } from '../db/index.ts';

const BASE_URL = 'https://api.twitterapi.io';

export class TwitterApiIoProvider implements DataProvider {
  id = 'twitterapi-io' as const;
  name = 'twitterapi.io (Third-party Pay-per-item)';
  isFree = false;
  requiresKey = true;

  private getApiKey(): string | null {
    return process.env.TWITTERAPI_IO_KEY || null;
  }

  private async request(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('کلید TWITTERAPI_IO_KEY در متغیرهای محیطی تنظیم نشده است.');
    }

    const searchParams = new URLSearchParams(params);
    const url = `${BASE_URL}${endpoint}?${searchParams.toString()}`;

    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch(url, {
          headers: {
            'X-API-Key': key,
            'User-Agent': 'XMonitor/1.0',
          },
        });

        if (res.status === 429 || res.status >= 500) {
          if (attempts >= maxAttempts) {
            const body = await res.text();
            throw new Error(`twitterapi.io خطای ${res.status}: ${body}`);
          }
          const jitter = Math.random() * 500;
          await new Promise((r) => setTimeout(r, delay + jitter));
          delay *= 2;
          continue;
        }

        if (res.status === 402 || res.status === 403) {
          const body = await res.text();
          throw new Error(`اعتبار حساب twitterapi.io به پایان رسیده یا کلید نامعتبر است (کد ${res.status}): ${body}`);
        }

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`خطای twitterapi.io (${res.status}): ${body}`);
        }

        const data = await res.json();
        // Check for specific API error fields
        if (data.status === 'error' || data.error) {
          throw new Error(data.message || data.error || 'خطای نامشخص از twitterapi.io');
        }
        return data;
      } catch (err: any) {
        if (attempts >= maxAttempts || err.message.includes('اعتبار حساب')) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }

  async resolveAccount(username: string): Promise<NormalizedUser> {
    const cleanUsername = username.replace(/^@/, '');
    const data = await this.request('/twitter/user/info', { userName: cleanUsername });
    const user = data.data || data.user || data;

    if (!user || (!user.id && !user.id_str)) {
      throw new Error(`کاربر @${cleanUsername} در twitterapi.io یافت نشد.`);
    }

    return {
      id: String(user.id || user.id_str),
      username: user.userName || user.username || cleanUsername,
      name: user.name || user.userName || cleanUsername,
      avatarUrl: user.profilePicture || user.profile_image_url_https,
      verified: !!user.isBlueVerified || !!user.verified,
    };
  }

  async fetchNew(source: SourceEntity, state: Record<string, unknown>): Promise<FetchResult> {
    const lastSeenTime = (state.last_seen_time as number) || Math.floor(Date.now() / 1000) - 86400 * 7;
    const lastSeenIds = new Set<string>((state.last_seen_ids as string[]) || []);
    const users: NormalizedUser[] = [];
    const posts: NormalizedPost[] = [];
    const newSeenIds: string[] = [];
    let newestTime = lastSeenTime;

    // Timeline fallback logic
    const useTimelineFallback =
      Boolean(source.use_timeline_fallback) ||
      (Number(source.consecutive_failures || 0) >= 3 && source.type === 'account');

    if (useTimelineFallback && source.type === 'account') {
      const cleanUsername = source.value.replace(/^@/, '');
      const data = await this.request('/twitter/user/last_tweets', {
        userName: cleanUsername,
      });

      const rawTweets = data.tweets || data.data?.tweets || [];
      for (const t of rawTweets) {
        const id = String(t.id || t.id_str);
        if (lastSeenIds.has(id)) {
          break; // Stop at first already-stored id
        }
        newSeenIds.push(id);
        const normalized = this.normalizeTweet(t);
        posts.push(normalized);
        const tTime = Math.floor(new Date(normalized.createdAt).getTime() / 1000);
        if (tTime > newestTime) newestTime = tTime;
      }
    } else {
      // Advanced Search (Default for all types)
      let query = '';
      if (source.type === 'account') {
        const cleanUsername = source.value.replace(/^@/, '');
        query = `from:${cleanUsername} since_time:${lastSeenTime}`;
      } else {
        let base = source.value;
        if (source.type === 'hashtag') {
          base = source.value.startsWith('#') ? source.value : `#${source.value}`;
        }
        if (source.exclude_replies) base += ' -filter:replies';
        if (source.exclude_retweets) base += ' -filter:retweets';
        if (source.lang) base += ` lang:${source.lang}`;
        if (!base.includes('since_time:')) {
          base += ` since_time:${lastSeenTime}`;
        }
        query = base;
      }

      let cursor = '';
      let hasNextPage = true;
      const maxItems = Math.min(Math.max(source.max_results || 20, 5), 100);

      while (hasNextPage && posts.length < maxItems) {
        const params: Record<string, string> = {
          query,
          queryType: 'Latest',
        };
        if (cursor) params.cursor = cursor;

        const data = await this.request('/twitter/tweet/advanced_search', params);
        const rawTweets = data.tweets || [];
        if (rawTweets.length === 0) break;

        let hitStored = false;
        for (const t of rawTweets) {
          const id = String(t.id || t.id_str);
          if (lastSeenIds.has(id)) {
            hitStored = true;
            break;
          }
          newSeenIds.push(id);
          const normalized = this.normalizeTweet(t);
          posts.push(normalized);

          const tTime = Math.floor(new Date(normalized.createdAt).getTime() / 1000);
          if (tTime > newestTime) newestTime = tTime;

          if (posts.length >= maxItems) break;
        }

        if (hitStored || !data.has_next_page || !data.next_cursor) {
          hasNextPage = false;
        } else {
          cursor = data.next_cursor;
        }
      }
    }

    const mergedSeen = Array.from(new Set([...newSeenIds, ...Array.from(lastSeenIds)])).slice(0, 100);

    const newState = {
      ...state,
      last_seen_time: Math.max(newestTime - 60, lastSeenTime), // 60-second overlap window
      last_seen_ids: mergedSeen,
      last_polled_at: new Date().toISOString(),
    };

    const usage: ProviderUsage = {
      postsRead: posts.length,
      usersRead: users.length,
      calls: 1,
      endpoint: useTimelineFallback ? '/twitter/user/last_tweets' : '/twitter/tweet/advanced_search',
    };

    return {
      posts,
      users,
      newState,
      usage,
    };
  }

  private normalizeTweet(t: any): NormalizedPost {
    const id = String(t.id || t.id_str);
    const author = t.author || t.user || {};
    const metrics = t.metrics || {};

    const mediaList: any[] = [];
    if (Array.isArray(t.media)) {
      for (const m of t.media) {
        mediaList.push({
          type: m.type || 'photo',
          url: m.url || m.media_url_https || '',
          previewUrl: m.preview_image_url || m.url,
        });
      }
    } else if (Array.isArray(t.entities?.media)) {
      for (const m of t.entities.media) {
        mediaList.push({
          type: m.type || 'photo',
          url: m.media_url_https || m.url || '',
          previewUrl: m.media_url_https,
        });
      }
    }

    return {
      id,
      authorId: author.id ? String(author.id) : undefined,
      authorUsername: author.userName || author.username || author.screen_name || 'unknown',
      authorName: author.name || author.userName || 'Unknown',
      authorAvatar: author.profilePicture || author.profile_image_url_https,
      text: t.text || t.full_text || '',
      lang: t.lang,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
      metrics: {
        likes: Number(t.likeCount || metrics.likeCount || t.favorite_count || 0),
        retweets: Number(t.retweetCount || metrics.retweetCount || t.retweet_count || 0),
        replies: Number(t.replyCount || metrics.replyCount || 0),
        quotes: Number(t.quoteCount || metrics.quoteCount || 0),
        views: t.viewCount !== undefined ? Number(t.viewCount) : undefined,
      },
      media: mediaList,
      url: t.url || `https://x.com/${author.userName || 'i'}/status/${id}`,
      isReply: !!t.isReply || !!t.in_reply_to_status_id_str,
      isRetweet: !!t.isRetweet || (t.text && t.text.startsWith('RT @')),
      isQuote: !!t.isQuote || !!t.quoted_status_id_str,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.getApiKey()) {
      return { ok: false, message: 'کلید TWITTERAPI_IO_KEY تنظیم نشده است (پیکربندی‌نشده).' };
    }
    try {
      const data = await this.request('/twitter/user/info', { userName: 'x' });
      if (data) {
        return { ok: true, message: 'اتصال به سرویس twitterapi.io با موفقیت برقرار شد.' };
      }
      return { ok: false, message: 'پاسخ نامعتبر از twitterapi.io' };
    } catch (err: any) {
      return { ok: false, message: `خطا در اتصال به twitterapi.io: ${err.message}` };
    }
  }

  estimateCost(usage: ProviderUsage): number {
    const rowTweets = db.prepare("SELECT value FROM settings WHERE key = 'price_twitterapi_io_tweet_read'").get() as { value: string } | undefined;
    const rowUsers = db.prepare("SELECT value FROM settings WHERE key = 'price_twitterapi_io_user_read'").get() as { value: string } | undefined;
    const rowMinCall = db.prepare("SELECT value FROM settings WHERE key = 'price_twitterapi_io_min_call'").get() as { value: string } | undefined;

    const priceTweet = parseFloat(rowTweets?.value || '0.00015');
    const priceUser = parseFloat(rowUsers?.value || '0.00018');
    const minCall = parseFloat(rowMinCall?.value || '0');

    const calculated = usage.postsRead * priceTweet + usage.usersRead * priceUser;
    return Math.max(calculated, usage.calls * minCall);
  }
}
