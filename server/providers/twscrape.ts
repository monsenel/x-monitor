import type { DataProvider, FetchResult, HealthCheckResult, NormalizedPost, NormalizedUser, ProviderUsage, SourceEntity } from './types.ts';
import { db } from '../db/index.ts';

export function getSidecarUrl(): string {
  if (process.env.SIDECAR_URL) {
    if (process.env.SIDECAR_URL.includes('127.0.0.1:8000') || process.env.SIDECAR_URL.includes('localhost:8000')) {
      return 'http://127.0.0.1:8008';
    }
    return process.env.SIDECAR_URL;
  }
  return process.env.NODE_ENV === 'production' ? 'http://scraper:8000' : 'http://127.0.0.1:8008';
}

const SIDECAR_SECRET = process.env.SIDECAR_SHARED_SECRET || 'xmonitor-internal-secret-change-me';

export class TwscrapeProvider implements DataProvider {
  id = 'twscrape' as const;
  name = 'twscrape (Sidecar - Free/Default)';
  isFree = true;
  requiresKey = false;

  private async callSidecar<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${getSidecarUrl().replace(/\/$/, '')}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Sidecar-Secret': SIDECAR_SECRET,
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        let errBody: any;
        try {
          errBody = await res.json();
        } catch {
          errBody = { message: await res.text() };
        }
        if (res.status === 401 && !errBody?.detail?.toLowerCase().includes('secret')) {
          throw new Error('سرویس اسکرپر (twscrape) در این آدرس فعال نیست یا درخواست توسط سرویس دیگری پاسخ داده شد.');
        }
        const msg = errBody.detail || errBody.message || `سایدکار پاسخ داد: HTTP ${res.status}`;
        throw new Error(msg);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('زمان انتظار برای اتصال به سایدکار اسکرپر به پایان رسید (Timeout).');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveAccount(username: string): Promise<NormalizedUser> {
    const cleanUsername = username.replace(/^@/, '');
    const data = await this.callSidecar<{
      id: string;
      username: string;
      name: string;
      avatar_url?: string;
      verified?: boolean;
    }>('/resolve', {
      method: 'POST',
      body: JSON.stringify({ username: cleanUsername }),
    });

    return {
      id: String(data.id),
      username: data.username,
      name: data.name || data.username,
      avatarUrl: data.avatar_url,
      verified: !!data.verified,
    };
  }

  async fetchNew(source: SourceEntity, state: Record<string, unknown>): Promise<FetchResult> {
    const lastSeenIds = new Set<string>((state.last_seen_ids as string[]) || []);
    const limit = Math.min(Math.max(source.max_results || 20, 5), 50);

    let rawPosts: any[] = [];
    const users: NormalizedUser[] = [];
    const calls = 1;

    if (source.type === 'account') {
      let userId = source.x_user_id;
      if (!userId) {
        const user = await this.resolveAccount(source.value);
        userId = user.id;
        users.push(user);
      }

      const res = await this.callSidecar<{ tweets: any[] }>('/user-tweets', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, limit }),
      });
      rawPosts = res.tweets || [];
    } else {
      // Query builder for hashtag / keyword / query
      let query = source.value;
      if (source.type === 'hashtag') {
        const tag = source.value.startsWith('#') ? source.value : `#${source.value}`;
        query = tag;
      }
      if (source.exclude_retweets) {
        query += ' -filter:retweets';
      }
      if (source.exclude_replies) {
        query += ' -filter:replies';
      }
      if (source.lang) {
        query += ` lang:${source.lang}`;
      }

      const res = await this.callSidecar<{ tweets: any[] }>('/search', {
        method: 'POST',
        body: JSON.stringify({ query, limit }),
      });
      rawPosts = res.tweets || [];
    }

    const posts: NormalizedPost[] = [];
    const newSeenIds: string[] = [];

    for (const item of rawPosts) {
      if (!item || !item.id) continue;
      const postId = String(item.id);

      if (lastSeenIds.has(postId)) {
        // Stop at first already-stored post for account timelines, or skip for search
        if (source.type === 'account') {
          break;
        }
        continue;
      }

      newSeenIds.push(postId);

      posts.push({
        id: postId,
        authorId: item.author?.id ? String(item.author.id) : undefined,
        authorUsername: item.author?.username || 'unknown',
        authorName: item.author?.name || item.author?.username || 'Unknown',
        authorAvatar: item.author?.avatar_url,
        text: item.text || '',
        lang: item.lang,
        createdAt: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString(),
        metrics: {
          likes: Number(item.metrics?.likes || item.like_count || 0),
          retweets: Number(item.metrics?.retweets || item.retweet_count || 0),
          replies: Number(item.metrics?.replies || item.reply_count || 0),
          quotes: Number(item.metrics?.quotes || item.quote_count || 0),
          views: item.metrics?.views !== undefined ? Number(item.metrics.views) : undefined,
        },
        media: Array.isArray(item.media)
          ? item.media.map((m: any) => ({
              type: m.type || 'photo',
              url: m.url || '',
              previewUrl: m.preview_url || m.url,
            }))
          : [],
        url: item.url || `https://x.com/${item.author?.username || 'i'}/status/${postId}`,
        isReply: !!item.is_reply,
        isRetweet: !!item.is_retweet,
        isQuote: !!item.is_quote,
      });
    }

    // Keep up to 100 most recent seen IDs in state
    const mergedSeen = Array.from(new Set([...newSeenIds, ...Array.from(lastSeenIds)])).slice(0, 100);

    const newState = {
      ...state,
      last_seen_ids: mergedSeen,
      last_polled_at: new Date().toISOString(),
    };

    const usage: ProviderUsage = {
      postsRead: posts.length,
      usersRead: users.length,
      calls,
      endpoint: source.type === 'account' ? '/user-tweets' : '/search',
    };

    return { posts, users, newState, usage };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const data = await this.callSidecar<{ status: string; accounts_count?: number; locked_count?: number }>('/health');
      if (data && data.status === 'ok') {
        const count = data.accounts_count ?? 0;
        const msg = count > 0
          ? `سرویس اسکرپر متصل است (${count} حساب ثبت‌شده، ${data.locked_count || 0} قفل‌شده)`
          : `سرویس اسکرپر متصل است اما هیچ حسابی ثبت نشده است. لطفاً در بخش تنظیمات حساب اسکرپر اضافه کنید.`;
        return { ok: true, message: msg, details: data };
      }
      return { ok: false, message: `پاسخ نامعتبر از سایدکار: ${JSON.stringify(data)}` };
    } catch (err: any) {
      return {
        ok: false,
        message: `اتصال به سایدکار اسکرپر برقرار نشد (${err.message}). اطمینان حاصل کنید کانتینر اسکرپر اجرا شده است.`,
      };
    }
  }

  estimateCost(_usage: ProviderUsage): number {
    return 0; // Free
  }
}
