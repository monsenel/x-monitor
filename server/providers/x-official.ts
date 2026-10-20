import type { DataProvider, FetchResult, HealthCheckResult, NormalizedPost, NormalizedUser, ProviderUsage, SourceEntity } from './types.ts';
import { db } from '../db/index.ts';

export class XOfficialProvider implements DataProvider {
  id = 'x-official' as const;
  name = 'Official X API v2 (Pay-per-use)';
  isFree = false;
  requiresKey = true;

  private getBearerToken(): string | null {
    return process.env.X_BEARER_TOKEN || null;
  }

  private async request(url: string, endpointKey: string): Promise<any> {
    const token = this.getBearerToken();
    if (!token) {
      throw new Error('توکن X_BEARER_TOKEN در متغیرهای محیطی تنظیم نشده است.');
    }

    // Check cached rate limit
    const rl = db.prepare('SELECT remaining, reset_at FROM rate_limits WHERE provider = ? AND endpoint = ?')
      .get(this.id, endpointKey) as { remaining: number; reset_at: string } | undefined;

    if (rl && rl.remaining <= 0 && new Date(rl.reset_at) > new Date()) {
      throw new Error(`محدودیت نرخ (Rate limit) برای X API v2 تا زمان ${rl.reset_at} به پایان رسیده است.`);
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'XMonitor/1.0',
      },
    });

    // Update rate limits from response headers
    const remaining = res.headers.get('x-rate-limit-remaining');
    const reset = res.headers.get('x-rate-limit-reset');
    if (remaining !== null && reset !== null) {
      const resetDate = new Date(parseInt(reset, 10) * 1000).toISOString();
      db.prepare(`
        INSERT INTO rate_limits (provider, endpoint, remaining, reset_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(provider, endpoint) DO UPDATE SET
          remaining = excluded.remaining,
          reset_at = excluded.reset_at,
          updated_at = excluded.updated_at
      `).run(this.id, endpointKey, parseInt(remaining, 10), resetDate, new Date().toISOString());
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`X API v2 error (${res.status}): ${err}`);
    }

    return await res.json();
  }

  async resolveAccount(username: string): Promise<NormalizedUser> {
    const cleanUsername = username.replace(/^@/, '');
    const data = await this.request(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(cleanUsername)}?user.fields=profile_image_url,verified`,
      '/2/users/by/username'
    );

    if (!data.data) {
      throw new Error(`کاربر @${cleanUsername} در X یافت نشد.`);
    }

    return {
      id: data.data.id,
      username: data.data.username,
      name: data.data.name,
      avatarUrl: data.data.profile_image_url,
      verified: !!data.data.verified,
    };
  }

  async fetchNew(source: SourceEntity, state: Record<string, unknown>): Promise<FetchResult> {
    const sinceId = (state.since_id as string) || source.since_id || undefined;
    const maxResults = Math.min(Math.max(source.max_results || 10, 5), 100);

    let url = '';
    let endpointKey = '';
    const usersMap = new Map<string, NormalizedUser>();
    const mediaMap = new Map<string, { type: 'photo' | 'video' | 'animated_gif'; url: string; previewUrl?: string }>();

    if (source.type === 'account') {
      let userId = source.x_user_id;
      if (!userId) {
        const user = await this.resolveAccount(source.value);
        userId = user.id;
        usersMap.set(user.id, user);
      }

      endpointKey = '/2/users/:id/tweets';
      const params = new URLSearchParams({
        max_results: String(maxResults),
        'tweet.fields': 'created_at,lang,public_metrics,entities,attachments,conversation_id,referenced_tweets',
        expansions: 'author_id,attachments.media_keys',
        'user.fields': 'username,name,profile_image_url,verified',
        'media.fields': 'type,url,preview_image_url',
      });

      const excludes: string[] = [];
      if (source.exclude_retweets) excludes.push('retweets');
      if (source.exclude_replies) excludes.push('replies');
      if (excludes.length > 0) params.set('exclude', excludes.join(','));
      if (sinceId) params.set('since_id', sinceId);

      url = `https://api.x.com/2/users/${userId}/tweets?${params.toString()}`;
    } else {
      endpointKey = '/2/tweets/search/recent';
      let q = source.value;
      if (source.type === 'hashtag') {
        const tag = source.value.startsWith('#') ? source.value : `#${source.value}`;
        q = tag;
      }
      if (source.exclude_retweets) q += ' -is:retweet';
      if (source.exclude_replies) q += ' -is:reply';
      if (source.lang) q += ` lang:${source.lang}`;

      const params = new URLSearchParams({
        query: q.slice(0, 512),
        max_results: String(maxResults),
        'tweet.fields': 'created_at,lang,public_metrics,entities,attachments,conversation_id,referenced_tweets',
        expansions: 'author_id,attachments.media_keys',
        'user.fields': 'username,name,profile_image_url,verified',
        'media.fields': 'type,url,preview_image_url',
      });
      if (sinceId) params.set('since_id', sinceId);

      url = `https://api.x.com/2/tweets/search/recent?${params.toString()}`;
    }

    const data = await this.request(url, endpointKey);

    // Parse expansions: users & media
    if (data.includes?.users) {
      for (const u of data.includes.users) {
        usersMap.set(u.id, {
          id: u.id,
          username: u.username,
          name: u.name,
          avatarUrl: u.profile_image_url,
          verified: !!u.verified,
        });
      }
    }
    if (data.includes?.media) {
      for (const m of data.includes.media) {
        mediaMap.set(m.media_key, {
          type: m.type === 'photo' ? 'photo' : m.type === 'video' ? 'video' : 'animated_gif',
          url: m.url || m.preview_image_url || '',
          previewUrl: m.preview_image_url,
        });
      }
    }

    const posts: NormalizedPost[] = [];
    const tweets = data.data || [];
    let newestId = sinceId;

    for (const t of tweets) {
      const author = usersMap.get(t.author_id);
      const postMedia = (t.attachments?.media_keys || [])
        .map((k: string) => mediaMap.get(k))
        .filter(Boolean);

      const isRetweet = t.referenced_tweets?.some((r: any) => r.type === 'retweeted') || false;
      const isReply = t.referenced_tweets?.some((r: any) => r.type === 'replied_to') || !!t.in_reply_to_user_id;
      const isQuote = t.referenced_tweets?.some((r: any) => r.type === 'quoted') || false;

      posts.push({
        id: t.id,
        authorId: t.author_id,
        authorUsername: author?.username || 'unknown',
        authorName: author?.name || author?.username || 'Unknown',
        authorAvatar: author?.avatarUrl,
        text: t.text || '',
        lang: t.lang,
        createdAt: t.created_at || new Date().toISOString(),
        metrics: {
          likes: t.public_metrics?.like_count || 0,
          retweets: t.public_metrics?.retweet_count || 0,
          replies: t.public_metrics?.reply_count || 0,
          quotes: t.public_metrics?.quote_count || 0,
          views: t.public_metrics?.impression_count,
        },
        media: postMedia,
        url: `https://x.com/${author?.username || 'i'}/status/${t.id}`,
        isReply,
        isRetweet,
        isQuote,
      });

      if (!newestId || BigInt(t.id) > BigInt(newestId)) {
        newestId = t.id;
      }
    }

    const newState = {
      ...state,
      since_id: data.meta?.newest_id || newestId || sinceId,
      last_polled_at: new Date().toISOString(),
    };

    const usage: ProviderUsage = {
      postsRead: posts.length,
      usersRead: usersMap.size,
      calls: 1,
      endpoint: endpointKey,
    };

    return {
      posts,
      users: Array.from(usersMap.values()),
      newState,
      usage,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.getBearerToken()) {
      return { ok: false, message: 'کلید X_BEARER_TOKEN در متغیرهای محیطی تنظیم نشده است (پیکربندی‌نشده).' };
    }
    try {
      await this.request('https://api.x.com/2/users/by/username/x', '/2/users/by/username');
      return { ok: true, message: 'اتصال رسمی به X API v2 با موفقیت برقرار شد.' };
    } catch (err: any) {
      return { ok: false, message: `خطا در اتصال به X API v2: ${err.message}` };
    }
  }

  estimateCost(usage: ProviderUsage): number {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'price_x_official_tweet_read'").get() as { value: string } | undefined;
    const pricePerTweet = parseFloat(row?.value || '0.005');
    return usage.postsRead * pricePerTweet;
  }
}
