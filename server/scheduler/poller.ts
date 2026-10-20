import { db } from '../db/index.ts';
import { providerRegistry } from '../providers/index.ts';
import type { NormalizedPost, SourceEntity } from '../providers/types.ts';
import { sseManager } from './sse.ts';
import { alertEngine } from '../alerts/engine.ts';
import { enrichPostsBatch, clusterRecentPosts, generateDigest } from '../ai/gemini.ts';

export class SchedulerPoller {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private sidecarQueueLock = false; // Twscrape sidecar 1 concurrency limit

  start() {
    this.spreadOverdueOnStartup();
    // Tick every 15 seconds
    this.timer = setInterval(() => this.tick(), 15000);
    // Also run an immediate tick after 3 seconds
    setTimeout(() => this.tick(), 3000);
    console.log('[Scheduler] Started in-process poller.');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // On startup, overdue sources are spread over the next few minutes rather than fired together
  private spreadOverdueOnStartup() {
    const now = new Date();
    const rows = db.prepare('SELECT id, next_poll_at FROM sources WHERE enabled = 1').all() as unknown as { id: string; next_poll_at: string }[];
    let offsetSeconds = 5;

    for (const row of rows) {
      if (!row.next_poll_at || new Date(row.next_poll_at) < now) {
        const spreadTime = new Date(now.getTime() + offsetSeconds * 1000).toISOString();
        db.prepare('UPDATE sources SET next_poll_at = ? WHERE id = ?').run(spreadTime, row.id);
        offsetSeconds += 15; // Spread out 15 seconds apart
      }
    }
  }

  async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const isPausedRow = db.prepare("SELECT value FROM settings WHERE key = 'global_polling_paused'").get() as { value: string } | undefined;
      if (isPausedRow?.value === '1') {
        return;
      }

      await this.checkBudgetsAndKillSwitches();
      await this.pollEligibleSources();
      await this.processPendingAiEnrichment();
      await this.checkScheduledDigests();
    } catch (err) {
      console.error('[Scheduler] Error in poller tick:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  // Check monthly budgets and trigger kill switches if exceeded
  async checkBudgetsAndKillSwitches() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const spendRows = db.prepare(`
      SELECT provider, SUM(est_cost_usd) as total_spend
      FROM usage_log
      WHERE ts >= ?
      GROUP BY provider
    `).all(monthStart) as unknown as { provider: string; total_spend: number }[];

    const spendMap: Record<string, number> = {};
    let totalSpend = 0;
    for (const r of spendRows) {
      spendMap[r.provider] = r.total_spend || 0;
      totalSpend += r.total_spend || 0;
    }

    const bX = parseFloat((db.prepare("SELECT value FROM settings WHERE key = 'budget_x_official_monthly'").get() as any)?.value || '10');
    const bTw = parseFloat((db.prepare("SELECT value FROM settings WHERE key = 'budget_twitterapi_io_monthly'").get() as any)?.value || '5');
    const bTot = parseFloat((db.prepare("SELECT value FROM settings WHERE key = 'budget_total_monthly'").get() as any)?.value || '15');

    // Check kill switch for X official
    if (bX > 0 && (spendMap['x-official'] || 0) >= bX) {
      sseManager.broadcast('budget_warning', {
        provider: 'x-official',
        killed: true,
        message: 'سقف بودجه ماهانه X Official پر شد؛ درخواست‌های این ارائه‌دهنده متوقف شدند.',
      });
    }

    // Check kill switch for twitterapi.io
    if (bTw > 0 && (spendMap['twitterapi-io'] || 0) >= bTw) {
      sseManager.broadcast('budget_warning', {
        provider: 'twitterapi-io',
        killed: true,
        message: 'سقف بودجه ماهانه twitterapi.io پر شد؛ درخواست‌های این ارائه‌دهنده متوقف شدند.',
      });
    }

    // Check global budget
    if (bTot > 0 && totalSpend >= bTot) {
      sseManager.broadcast('budget_warning', {
        provider: 'all',
        killed: true,
        message: 'سقف کل بودجه ماهانه سیستم تکمیل شد!',
      });
    }
  }

  // Find sources whose next_poll_at is <= now
  private async pollEligibleSources() {
    const now = new Date().toISOString();
    const sources = db.prepare(`
      SELECT * FROM sources
      WHERE enabled = 1 AND (next_poll_at IS NULL OR next_poll_at <= ?)
      ORDER BY priority DESC, next_poll_at ASC
      LIMIT 10
    `).all(now) as unknown as SourceEntity[];

    for (const source of sources) {
      await this.pollSource(source);
    }
  }

  // Calculate effective interval in minutes
  calculateEffectiveInterval(source: SourceEntity): { intervalMinutes: number; sourceLevel: 'source' | 'group' | 'global' } {
    if (source.interval_minutes && source.interval_minutes > 0) {
      return { intervalMinutes: source.interval_minutes, sourceLevel: 'source' };
    }

    if (source.group_id) {
      const grp = db.prepare('SELECT default_interval_minutes FROM groups WHERE id = ?').get(source.group_id) as any;
      if (grp?.default_interval_minutes && grp.default_interval_minutes > 0) {
        return { intervalMinutes: grp.default_interval_minutes, sourceLevel: 'group' };
      }
    }

    const globalInterval = db.prepare("SELECT value FROM settings WHERE key = 'global_poll_interval_minutes'").get() as any;
    return {
      intervalMinutes: parseInt(globalInterval?.value || '30', 10),
      sourceLevel: 'global',
    };
  }

  // Calculate provider minimum floor
  getProviderFloor(providerId: string, sourceType: string): number {
    if (providerId === 'twscrape') {
      const key = sourceType === 'account' ? 'floor_twscrape_account' : 'floor_twscrape_search';
      const val = (db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any)?.value;
      return parseInt(val || (sourceType === 'account' ? '15' : '30'), 10);
    }
    if (providerId === 'nitter-rss') {
      const val = (db.prepare("SELECT value FROM settings WHERE key = 'floor_nitter_rss'").get() as any)?.value;
      return parseInt(val || '10', 10);
    }
    if (providerId === 'x-official') {
      const val = (db.prepare("SELECT value FROM settings WHERE key = 'floor_x_official'").get() as any)?.value;
      return parseInt(val || '15', 10);
    }
    if (providerId === 'twitterapi-io') {
      const val = (db.prepare("SELECT value FROM settings WHERE key = 'floor_twitterapi_io'").get() as any)?.value;
      return parseInt(val || '5', 10);
    }
    return 15;
  }

  // Calculate next poll date with jitter and active hours
  calculateNextPoll(source: SourceEntity, providerId: string): string {
    const { intervalMinutes } = this.calculateEffectiveInterval(source);
    const floor = this.getProviderFloor(providerId, source.type);
    let effectiveInterval = Math.max(intervalMinutes, floor);

    // Apply active hours check
    const inActiveHours = this.isWithinActiveHours(source);
    if (!inActiveHours) {
      if (source.off_hours_mode === 'slow') {
        effectiveInterval = Math.max(source.off_hours_interval_minutes || 180, effectiveInterval);
      } else {
        // Paused during off hours: check again in 30 minutes
        effectiveInterval = 30;
      }
    }

    // Apply jitter (default ±20%)
    const jitterPercentRow = db.prepare("SELECT value FROM settings WHERE key = 'global_jitter_percent'").get() as any;
    const jitterPercent = parseInt(jitterPercentRow?.value || '20', 10) / 100;

    const jitterFactor = 1 + (Math.random() * 2 - 1) * jitterPercent;
    const minutesWithJitter = Math.max(effectiveInterval * jitterFactor, 1);

    const nextDate = new Date(Date.now() + minutesWithJitter * 60 * 1000);
    return nextDate.toISOString();
  }

  // Active hours & days validation
  private isWithinActiveHours(source: SourceEntity): boolean {
    let activeHoursJson = source.active_hours_json;
    if (!activeHoursJson && source.group_id) {
      const grp = db.prepare('SELECT active_hours_json FROM groups WHERE id = ?').get(source.group_id) as any;
      activeHoursJson = grp?.active_hours_json;
    }

    if (!activeHoursJson) return true;

    try {
      const conf = JSON.parse(activeHoursJson);
      if (!conf.enabled) return true;

      const tz = conf.timezone || 'Asia/Tehran';
      const nowStr = new Date().toLocaleString('en-US', { timeZone: tz, hour12: false });
      const localNow = new Date(nowStr);

      const day = localNow.getDay(); // 0 is Sunday, 6 is Saturday
      if (conf.days && Array.isArray(conf.days) && !conf.days.includes(day)) {
        return false;
      }

      if (conf.startHour !== undefined && conf.endHour !== undefined) {
        const hour = localNow.getHours();
        if (conf.startHour <= conf.endHour) {
          if (hour < conf.startHour || hour >= conf.endHour) return false;
        } else {
          // Crosses midnight
          if (hour < conf.startHour && hour >= conf.endHour) return false;
        }
      }

      return true;
    } catch {
      return true;
    }
  }

  async pollSource(source: SourceEntity, isManual = false): Promise<{ success: boolean; newPostsCount: number; error?: string }> {
    const provider = providerRegistry.getEffectiveProviderForSource(source.provider, source.consecutive_failures || 0);

    // Global twscrape sidecar concurrency limit: 1 request at a time
    if (provider.id === 'twscrape') {
      if (this.sidecarQueueLock && !isManual) {
        return { success: false, newPostsCount: 0, error: 'Sidecar is busy with another request.' };
      }
      this.sidecarQueueLock = true;
    }

    try {
      let state: Record<string, unknown> = {};
      if (source.provider_state_json) {
        try {
          state = JSON.parse(source.provider_state_json);
        } catch {}
      }

      let result: any;
      let effectiveProvider = provider;

      try {
        result = await provider.fetchNew(source, state);
      } catch (primaryErr: any) {
        const autoNitterFallback = (db.prepare("SELECT value FROM settings WHERE key = 'auto_nitter_fallback'").get() as any)?.value !== '0';
        if (provider.id === 'twscrape' && autoNitterFallback) {
          const nitter = providerRegistry.get('nitter-rss');
          if (nitter) {
            try {
              result = await nitter.fetchNew(source, state);
              effectiveProvider = nitter;
            } catch {
              throw primaryErr;
            }
          } else {
            throw primaryErr;
          }
        } else {
          throw primaryErr;
        }
      }

      const estCost = effectiveProvider.estimateCost(result.usage);

      // Log usage
      db.prepare(`
        INSERT INTO usage_log (ts, provider, endpoint, source_id, posts_read, users_read, calls, est_cost_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        new Date().toISOString(),
        effectiveProvider.id,
        result.usage.endpoint || 'fetch',
        source.id,
        result.usage.postsRead,
        result.usage.usersRead,
        result.usage.calls,
        estCost
      );

      // Save posts and link to source
      let newPostsCount = 0;
      const insertedPosts: NormalizedPost[] = [];

      const insertPostStmt = db.prepare(`
        INSERT INTO posts (
          x_post_id, author_id, author_username, author_name, author_avatar,
          text, lang, created_at, metrics_json, media_json, url, fetched_at,
          ai_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(x_post_id) DO UPDATE SET
          metrics_json = excluded.metrics_json
      `);

      const linkStmt = db.prepare(`
        INSERT OR IGNORE INTO post_sources (post_id, source_id, matched_at)
        VALUES (?, ?, ?)
      `);

      const ftsStmt = db.prepare(`
        INSERT OR IGNORE INTO posts_fts (post_id, author_username, author_name, text, translation_fa)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const p of result.posts) {
        const existing = db.prepare('SELECT x_post_id FROM posts WHERE x_post_id = ?').get(p.id);
        insertPostStmt.run(
          p.id,
          p.authorId || null,
          p.authorUsername,
          p.authorName,
          p.authorAvatar || null,
          p.text,
          p.lang || null,
          p.createdAt,
          JSON.stringify(p.metrics),
          JSON.stringify(p.media),
          p.url,
          new Date().toISOString(),
          source.ai_enabled ? 'pending' : 'disabled'
        );

        linkStmt.run(p.id, source.id, new Date().toISOString());

        if (!existing) {
          newPostsCount++;
          insertedPosts.push(p);
          try {
            ftsStmt.run(p.id, p.authorUsername, p.authorName, p.text, '');
          } catch {}
        }
      }

      // Update source state & next_poll_at
      const nextPoll = this.calculateNextPoll(source, effectiveProvider.id);
      db.prepare(`
        UPDATE sources SET
          provider_state_json = ?,
          last_polled_at = ?,
          next_poll_at = ?,
          consecutive_failures = 0,
          last_error = NULL
        WHERE id = ?
      `).run(JSON.stringify(result.newState), new Date().toISOString(), nextPoll, source.id);

      // Process Alerts
      if (insertedPosts.length > 0) {
        await alertEngine.processNewPosts(insertedPosts, source.id);
        // Real-time broadcast to UI
        sseManager.broadcast('new_posts', {
          count: insertedPosts.length,
          sourceId: source.id,
          sourceValue: source.value,
          newestPost: insertedPosts[0],
        });
      }

      return { success: true, newPostsCount };
    } catch (err: any) {
      const errMsg = err.message || 'خطای نامشخص در هنگام دریافت اطلاعات';
      console.warn(`[Scheduler] Could not poll source ${source.id} (${source.value}):`, errMsg);

      // Back off source
      const consecutive = (source.consecutive_failures || 0) + 1;
      const nextPoll = new Date(Date.now() + Math.min(consecutive * 15, 120) * 60 * 1000).toISOString();

      db.prepare(`
        UPDATE sources SET
          last_error = ?,
          consecutive_failures = ?,
          next_poll_at = ?
        WHERE id = ?
      `).run(errMsg, consecutive, nextPoll, source.id);

      return { success: false, newPostsCount: 0, error: errMsg };
    } finally {
      if (provider.id === 'twscrape') {
        this.sidecarQueueLock = false;
      }
    }
  }

  // Process batched Gemini AI enrichment
  private async processPendingAiEnrichment() {
    const aiEnabledRow = db.prepare("SELECT value FROM settings WHERE key = 'ai_enrichment_enabled'").get() as any;
    if (aiEnabledRow?.value === '0') return;

    const batchSize = parseInt((db.prepare("SELECT value FROM settings WHERE key = 'ai_batch_size'").get() as any)?.value || '5', 10);
    const pending = db.prepare(`
      SELECT x_post_id as id, text, lang, author_username as author
      FROM posts
      WHERE ai_status = 'pending'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(batchSize) as unknown as { id: string; text: string; lang?: string; author: string }[];

    if (pending.length === 0) return;

    const results = await enrichPostsBatch(pending);

    const updateStmt = db.prepare(`
      UPDATE posts SET
        importance = ?,
        importance_reason = ?,
        sentiment = ?,
        topics_json = ?,
        translation_fa = ?,
        ai_status = 'done'
      WHERE x_post_id = ?
    `);

    for (const r of results) {
      updateStmt.run(
        r.importance,
        r.importanceReason,
        r.sentiment,
        JSON.stringify(r.topics),
        r.translationFa || null,
        r.postId
      );
      // Update FTS translation
      if (r.translationFa) {
        try {
          db.prepare('UPDATE posts_fts SET translation_fa = ? WHERE post_id = ?').run(r.translationFa, r.postId);
        } catch {}
      }
    }
  }

  // Digest scheduler check
  private async checkScheduledDigests() {
    const typeRow = db.prepare("SELECT value FROM settings WHERE key = 'digest_schedule_type'").get() as any;
    const scheduleType = typeRow?.value || 'daily';
    if (scheduleType === 'off') return;

    const lastRunRow = db.prepare("SELECT value FROM settings WHERE key = 'last_digest_run'").get() as any;
    const lastRun = lastRunRow?.value ? new Date(lastRunRow.value) : new Date(0);
    const now = new Date();

    let shouldRun = false;
    if (scheduleType === 'hourly') {
      if (now.getTime() - lastRun.getTime() >= 3600000) {
        shouldRun = true;
      }
    } else if (scheduleType === 'daily') {
      const targetTime = (db.prepare("SELECT value FROM settings WHERE key = 'digest_daily_time'").get() as any)?.value || '20:00';
      const [h, m] = targetTime.split(':').map((x: string) => parseInt(x, 10));
      if (now.getHours() === h && now.getMinutes() >= m && now.getTime() - lastRun.getTime() >= 72000000) {
        shouldRun = true;
      }
    }

    if (shouldRun) {
      await this.runDigest();
    }
  }

  async runDigest(): Promise<any> {
    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const posts = db.prepare(`
      SELECT p.x_post_id as id, p.author_username as author, p.text, p.importance, p.url, g.name as groupName
      FROM posts p
      LEFT JOIN post_sources ps ON p.x_post_id = ps.post_id
      LEFT JOIN sources s ON ps.source_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE p.created_at >= ?
      ORDER BY p.importance DESC
      LIMIT 40
    `).all(periodStart) as unknown as any[];

    const digest = await generateDigest(periodStart, periodEnd, posts);
    const id = `digest-${Date.now()}`;

    db.prepare(`
      INSERT INTO digests (id, title, period_start, period_end, content, top_posts_json, group_summaries_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      digest.title,
      periodStart,
      periodEnd,
      digest.content,
      JSON.stringify(digest.topPosts),
      JSON.stringify(digest.groupSummaries),
      new Date().toISOString()
    );

    db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_digest_run'").run(
      periodEnd,
      new Date().toISOString()
    );

    sseManager.broadcast('digest_ready', { id, title: digest.title });
    return { id, ...digest };
  }
}

export const scheduler = new SchedulerPoller();
