import type { DataProvider, HealthCheckResult, ProviderUsage } from './types.ts';
import { TwscrapeProvider } from './twscrape.ts';
import { NitterRssProvider } from './nitter-rss.ts';
import { XOfficialProvider } from './x-official.ts';
import { TwitterApiIoProvider } from './twitterapi-io.ts';
import { db } from '../db/index.ts';

export class ProviderRegistry {
  private providers: Map<string, DataProvider> = new Map();

  constructor() {
    this.register(new TwscrapeProvider());
    this.register(new NitterRssProvider());
    this.register(new XOfficialProvider());
    this.register(new TwitterApiIoProvider());
  }

  register(provider: DataProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): DataProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): DataProvider[] {
    return Array.from(this.providers.values());
  }

  getGlobalDefaultProviderId(): string {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'default_provider'").get() as { value: string } | undefined;
    return row?.value || 'twscrape';
  }

  getEffectiveProviderForSource(sourceProvider?: string | null, consecutiveFailures = 0): DataProvider {
    const autoNitterFallback = db.prepare("SELECT value FROM settings WHERE key = 'auto_nitter_fallback'").get() as { value: string } | undefined;
    const isFallbackEnabled = autoNitterFallback?.value !== '0';

    // If source failed 3 times in a row and fallback is enabled, switch to Nitter RSS
    if (isFallbackEnabled && consecutiveFailures >= 3) {
      const nitter = this.get('nitter-rss');
      if (nitter) return nitter;
    }

    const providerId = sourceProvider || this.getGlobalDefaultProviderId();
    const provider = this.get(providerId);

    if (!provider) {
      // Fallback to twscrape or nitter-rss
      return this.get('twscrape') || this.get('nitter-rss')!;
    }

    return provider;
  }

  async checkProviderHealth(id: string): Promise<HealthCheckResult> {
    const provider = this.get(id);
    if (!provider) {
      return { ok: false, message: `ارائه‌دهنده با شناسه ${id} یافت نشد.` };
    }
    return await provider.healthCheck();
  }

  estimateCost(providerId: string, usage: ProviderUsage): number {
    const provider = this.get(providerId);
    if (!provider) return 0;
    return provider.estimateCost(usage);
  }
}

export const providerRegistry = new ProviderRegistry();
