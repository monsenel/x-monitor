import { XMLParser } from 'fast-xml-parser';
import type { DataProvider, FetchResult, HealthCheckResult, NormalizedPost, NormalizedUser, ProviderUsage, SourceEntity } from './types.ts';
import { db } from '../db/index.ts';

interface InstanceHealth {
  url: string;
  lastSuccess?: number;
  lastFailure?: number;
  consecutiveFailures: number;
  lastHitAt: number;
}

const instanceHealthMap = new Map<string, InstanceHealth>();

export class NitterRssProvider implements DataProvider {
  id = 'nitter-rss' as const;
  name = 'Nitter RSS (Free Fallback)';
  isFree = true;
  requiresKey = false;

  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });
  }

  getInstances(): string[] {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'nitter_instances'").get() as { value: string } | undefined;
    if (!row || !row.value) return [];
    return row.value
      .split('\n')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter((s) => s.startsWith('https://'));
  }

  private pickHealthyInstance(): string | null {
    const instances = this.getInstances();
    if (instances.length === 0) return null;

    const now = Date.now();
    // Filter out instances with >=3 consecutive failures within the last 1 hour
    const candidates = instances.filter((url) => {
      const h = instanceHealthMap.get(url);
      if (!h) return true;
      if (h.consecutiveFailures >= 3 && now - (h.lastFailure || 0) < 3600000) {
        return false;
      }
      // Never hit the exact same instance more than once per 30s if multiple instances exist
      if (instances.length > 1 && now - h.lastHitAt < 30000) {
        return false;
      }
      return true;
    });

    const pool = candidates.length > 0 ? candidates : instances;
    // Pick the one least recently hit
    pool.sort((a, b) => {
      const ha = instanceHealthMap.get(a)?.lastHitAt || 0;
      const hb = instanceHealthMap.get(b)?.lastHitAt || 0;
      return ha - hb;
    });

    const picked = pool[0];
    const existing = instanceHealthMap.get(picked) || {
      url: picked,
      consecutiveFailures: 0,
      lastHitAt: 0,
    };
    existing.lastHitAt = now;
    instanceHealthMap.set(picked, existing);
    return picked;
  }

  private recordSuccess(instance: string) {
    const h = instanceHealthMap.get(instance) || { url: instance, consecutiveFailures: 0, lastHitAt: Date.now() };
    h.consecutiveFailures = 0;
    h.lastSuccess = Date.now();
    instanceHealthMap.set(instance, h);
  }

  private recordFailure(instance: string) {
    const h = instanceHealthMap.get(instance) || { url: instance, consecutiveFailures: 0, lastHitAt: Date.now() };
    h.consecutiveFailures += 1;
    h.lastFailure = Date.now();
    instanceHealthMap.set(instance, h);
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private extractMedia(html: string): { type: 'photo'; url: string }[] {
    const media: { type: 'photo'; url: string }[] = [];
    const imgRegex = /<img\s+[^>]*src="([^"]+)"/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      // Only keep images whose decoded original host is pbs.twimg.com
      if (src.includes('pbs.twimg.com')) {
        // Normalize nitter proxy URLs like https://nitter.net/pic/orig/https%3A%2F%2Fpbs.twimg.com...
        const twimgIdx = src.indexOf('pbs.twimg.com');
        if (twimgIdx !== -1) {
          src = 'https://' + src.slice(twimgIdx);
        }
        media.push({ type: 'photo', url: src });
      }
    }
    return media;
  }

  async resolveAccount(username: string): Promise<NormalizedUser> {
    const cleanUsername = username.replace(/^@/, '');
    return {
      id: cleanUsername,
      username: cleanUsername,
      name: cleanUsername,
      avatarUrl: undefined,
      verified: false,
    };
  }

  async fetchNew(source: SourceEntity, state: Record<string, unknown>): Promise<FetchResult> {
    const instance = this.pickHealthyInstance();
    if (!instance) {
      throw new Error('هیچ سرور Nitter فعالی در تنظیمات پیکربندی نشده یا همه سرورها موقتاً از دسترس خارج هستند.');
    }

    const lastSeenIds = new Set<string>((state.last_seen_ids as string[]) || []);
    let url = '';

    if (source.type === 'account') {
      const cleanUsername = source.value.replace(/^@/, '');
      url = `${instance}/${encodeURIComponent(cleanUsername)}/rss`;
    } else {
      let q = source.value;
      if (source.type === 'hashtag') {
        q = source.value.startsWith('#') ? source.value : `#${source.value}`;
      }
      if (source.exclude_retweets) q += ' -filter:retweets';
      if (source.exclude_replies) q += ' -filter:replies';
      if (source.lang) q += ` lang:${source.lang}`;
      url = `${instance}/search/rss?f=tweets&q=${encodeURIComponent(q)}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let xmlText = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        this.recordFailure(instance);
        throw new Error(`Nitter instance ${instance} HTTP ${res.status}`);
      }

      xmlText = await res.text();
      this.recordSuccess(instance);
    } catch (err: any) {
      this.recordFailure(instance);
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    const parsed = this.xmlParser.parse(xmlText);
    const channel = parsed?.rss?.channel;
    if (!channel) {
      return { posts: [], users: [], newState: state, usage: { postsRead: 0, usersRead: 0, calls: 1, endpoint: url } };
    }

    const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
    const posts: NormalizedPost[] = [];
    const newSeenIds: string[] = [];

    for (const item of rawItems) {
      const link = String(item.link || '');
      // Match status ID: /status/1234567890
      const statusMatch = link.match(/\/status\/(\d+)/);
      if (!statusMatch) continue;
      const postId = statusMatch[1];

      if (lastSeenIds.has(postId)) {
        if (source.type === 'account') {
          break; // Stop at first known ID for timelines
        }
        continue;
      }

      newSeenIds.push(postId);

      // Extract author from title or dc:creator or link
      const authorMatch = link.match(/https?:\/\/[^\/]+\/([^\/]+)\/status/);
      const authorUsername = item['dc:creator'] || authorMatch?.[1] || source.value.replace(/^@/, '');
      const rawDesc = String(item.description || '');
      const plainText = this.stripHtml(rawDesc);
      const media = this.extractMedia(rawDesc);

      posts.push({
        id: postId,
        authorUsername,
        authorName: authorUsername,
        text: plainText,
        createdAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        metrics: {
          likes: 0,
          retweets: 0,
          replies: 0,
        },
        media,
        url: `https://x.com/${authorUsername}/status/${postId}`,
        isReply: plainText.startsWith('R to @'),
        isRetweet: link.includes('/retweet/'),
        isQuote: false,
      });

      if (posts.length >= (source.max_results || 20)) {
        break;
      }
    }

    const mergedSeen = Array.from(new Set([...newSeenIds, ...Array.from(lastSeenIds)])).slice(0, 100);

    const newState = {
      ...state,
      last_seen_ids: mergedSeen,
      last_polled_at: new Date().toISOString(),
    };

    return {
      posts,
      users: [],
      newState,
      usage: {
        postsRead: posts.length,
        usersRead: 0,
        calls: 1,
        endpoint: 'rss',
      },
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const instances = this.getInstances();
    if (instances.length === 0) {
      return {
        ok: false,
        message: 'هیچ آدرس Nitter در تنظیمات وارد نشده است. لطفاً حداقل یک سرور معتبر اضافه کنید.',
      };
    }

    const results = await Promise.all(
      instances.map(async (inst) => {
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 6000);
          const res = await fetch(`${inst}/about`, { signal: c.signal });
          clearTimeout(t);
          return { url: inst, ok: res.status < 500 };
        } catch {
          return { url: inst, ok: false };
        }
      })
    );

    const activeCount = results.filter((r) => r.ok).length;
    return {
      ok: activeCount > 0,
      message: `${activeCount} از ${instances.length} سرور Nitter پاسخگو هستند.`,
      details: { instances: results },
    };
  }

  estimateCost(_usage: ProviderUsage): number {
    return 0; // Free
  }
}
