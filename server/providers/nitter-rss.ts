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

  // Only the bundled local Nitter is used (X account sessions are managed in Settings)
  getInstances(): string[] {
    return [(process.env.NITTER_LOCAL_URL || 'http://nitter:8080').replace(/\/$/, '')];
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
      // Links point at the Nitter instance that served the RSS (e.g. http://nitter/user/status/1#m); send them to x.com
      .replace(/https?:\/\/(?:nitter|localhost)(?::\d+)?\//gi, 'https://x.com/')
      .replace(/(\/status\/\d+)#m/g, '$1')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse runs of blank lines into a single newline
      .replace(/[ \t]*\n(?:[ \t]*\n)+/g, '\n')
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

  private async fetchSyndicationTimeline(
    username: string,
    lastSeenIds: Set<string>,
    maxResults: number
  ): Promise<{ posts: NormalizedPost[]; newSeenIds: string[] } | null> {
    const cleanUsername = username.replace(/^@/, '');
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(cleanUsername)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      if (!res.ok) return null;
      const html = await res.text();
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (!match?.[1]) return null;

      const data = JSON.parse(match[1]);
      const entries = data?.props?.pageProps?.timeline?.entries;
      if (!Array.isArray(entries)) return null;

      const posts: NormalizedPost[] = [];
      const newSeenIds: string[] = [];

      for (const entry of entries) {
        const tweet = entry?.content?.tweet;
        if (!tweet) continue;
        const postId = String(tweet.id_str || tweet.id || '');
        if (!postId) continue;

        if (lastSeenIds.has(postId)) {
          continue;
        }

        newSeenIds.push(postId);
        const user = tweet.user || {};
        const authorUsername = user.screen_name || cleanUsername;
        const mediaList: { type: 'photo'; url: string; previewUrl?: string }[] = [];
        const rawMedia = tweet.entities?.media || tweet.extended_entities?.media || [];
        if (Array.isArray(rawMedia)) {
          for (const m of rawMedia) {
            if (m?.media_url_https) {
              mediaList.push({
                type: 'photo',
                url: m.media_url_https,
                previewUrl: m.media_url_https,
              });
            }
          }
        }

        posts.push({
          id: postId,
          authorId: user.id_str ? String(user.id_str) : undefined,
          authorUsername,
          authorName: user.name || authorUsername,
          authorAvatar: user.profile_image_url_https || undefined,
          text: tweet.full_text || tweet.text || '',
          lang: tweet.lang || undefined,
          createdAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
          metrics: {
            likes: Number(tweet.favorite_count || 0),
            retweets: Number(tweet.retweet_count || 0),
            replies: Number(tweet.reply_count || 0),
            quotes: Number(tweet.quote_count || 0),
          },
          media: mediaList,
          url: `https://x.com/${authorUsername}/status/${postId}`,
          isReply: !!tweet.in_reply_to_status_id_str,
          isRetweet: !!tweet.retweeted_status,
          isQuote: !!tweet.is_quote_status,
        });

        if (posts.length >= maxResults) break;
      }

      return { posts, newSeenIds };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchNew(source: SourceEntity, state: Record<string, unknown>): Promise<FetchResult> {
    const lastSeenIds = new Set<string>((state.last_seen_ids as string[]) || []);
    const maxResults = source.max_results || 20;

    // For account sources, try X Syndication first as a fast, reliable, zero-key feed
    if (source.type === 'account') {
      const syndication = await this.fetchSyndicationTimeline(source.value, lastSeenIds, maxResults);
      if (syndication && syndication.posts.length > 0) {
        const mergedSeen = Array.from(new Set([...syndication.newSeenIds, ...Array.from(lastSeenIds)])).slice(0, 100);
        return {
          posts: syndication.posts,
          users: [],
          newState: {
            ...state,
            last_seen_ids: mergedSeen,
            last_polled_at: new Date().toISOString(),
          },
          usage: {
            postsRead: syndication.posts.length,
            usersRead: 0,
            calls: 1,
            endpoint: 'syndication-rss',
          },
        };
      }
    }

    const instances = this.getInstances();
    let xmlText = '';

    // Try up to 3 instances
    const maxAttempts = Math.min(Math.max(instances.length, 1), 3);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const instance = this.pickHealthyInstance();
      if (!instance) break;

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
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept: 'application/rss+xml, application/xml, text/xml',
          },
          signal: controller.signal,
        });

        if (res.ok) {
          xmlText = await res.text();
          this.recordSuccess(instance);
          break;
        } else {
          this.recordFailure(instance);
        }
      } catch {
        this.recordFailure(instance);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!xmlText) {
      return {
        posts: [],
        users: [],
        newState: {
          ...state,
          last_polled_at: new Date().toISOString(),
        },
        usage: { postsRead: 0, usersRead: 0, calls: 1, endpoint: 'rss' },
      };
    }

    const parsed = this.xmlParser.parse(xmlText);
    const channel = parsed?.rss?.channel;
    if (!channel) {
      return { posts: [], users: [], newState: state, usage: { postsRead: 0, usersRead: 0, calls: 1, endpoint: 'rss' } };
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
      // Nitter's dc:creator is "@name"; keep usernames bare so "@" prefixes and URLs aren't doubled
      const authorUsername = String(item['dc:creator'] || authorMatch?.[1] || source.value).replace(/^@/, '');
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

      if (posts.length >= maxResults) {
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
        message: 'آدرس Nitter محلی تنظیم نشده است.',
      };
    }

    const results = await Promise.all(
      instances.map(async (inst) => {
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 5000);
          const res = await fetch(`${inst}/about`, { signal: c.signal });
          clearTimeout(t);
          return { url: inst, ok: res.status < 500 };
        } catch {
          return { url: inst, ok: false };
        }
      })
    );

    const activeCount = results.filter((r) => r.ok).length;
    if (activeCount > 0) {
      return {
        ok: true,
        message: `${activeCount} از ${instances.length} سرور Nitter پاسخگو هستند.`,
        details: { instances: results },
      };
    }

    // Check if X Syndication fallback is reachable
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      const synRes = await fetch('https://syndication.twitter.com/srv/timeline-profile/screen-name/x', { signal: c.signal });
      clearTimeout(t);
      if (synRes.status < 500) {
        return {
          ok: true,
          message: 'فید جایگزین X Syndication فعال و آماده دریافت تایم‌لاین حساب‌ها است.',
          details: { instances: results, syndicationFallback: true },
        };
      }
    } catch {}

    return {
      ok: false,
      message: `0 از ${instances.length} سرور Nitter پاسخگو هستند.`,
      details: { instances: results },
    };
  }

  estimateCost(_usage: ProviderUsage): number {
    return 0; // Free
  }
}
