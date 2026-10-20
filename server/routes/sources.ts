import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { scheduler } from '../scheduler/poller.ts';
import { providerRegistry } from '../providers/index.ts';
import type { SourceEntity } from '../providers/types.ts';

export const sourcesRouter = Router();

const sourceSchema = z.object({
  type: z.enum(['account', 'hashtag', 'keyword', 'query']),
  value: z.string().min(1).max(512),
  interval_minutes: z.number().nullable().optional(),
  cron_expr: z.string().nullable().optional(),
  active_hours_json: z.string().nullable().optional(),
  off_hours_mode: z.enum(['pause', 'slow']).optional(),
  off_hours_interval_minutes: z.number().optional(),
  provider: z.string().nullable().optional(),
  use_timeline_fallback: z.number().optional(),
  display_name: z.string().optional(),
  group_id: z.string().nullable().optional(),
  color: z.string().optional(),
  priority: z.number().min(1).max(5).optional(),
  enabled: z.number().optional(),
  max_results: z.number().min(5).max(100).optional(),
  daily_cap: z.number().optional(),
  exclude_retweets: z.number().optional(),
  exclude_replies: z.number().optional(),
  lang: z.string().optional(),
  ai_enabled: z.number().optional(),
});

// List all sources with group info & stats
sourcesRouter.get('/', (_req, res) => {
  const sources = db.prepare(`
    SELECT s.*, g.name as group_name, g.color as group_color
    FROM sources s
    LEFT JOIN groups g ON s.group_id = g.id
    ORDER BY s.priority DESC, s.created_at DESC
  `).all() as unknown as (SourceEntity & { group_name?: string; group_color?: string })[];

  // Calculate posts today per source
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const postsTodayRows = db.prepare(`
    SELECT source_id, COUNT(*) as count
    FROM post_sources
    WHERE matched_at >= ?
    GROUP BY source_id
  `).all(todayIso) as unknown as { source_id: string; count: number }[];

  const costTodayRows = db.prepare(`
    SELECT source_id, SUM(est_cost_usd) as cost
    FROM usage_log
    WHERE ts >= ?
    GROUP BY source_id
  `).all(todayIso) as unknown as { source_id: string; cost: number }[];

  const postsTodayMap = new Map(postsTodayRows.map((r) => [r.source_id, r.count]));
  const costTodayMap = new Map(costTodayRows.map((r) => [r.source_id, r.cost]));

  const enriched = sources.map((s) => {
    const effective = scheduler.calculateEffectiveInterval(s);
    return {
      ...s,
      posts_today: postsTodayMap.get(s.id) || 0,
      cost_today: costTodayMap.get(s.id) || 0,
      effective_interval_minutes: effective.intervalMinutes,
      effective_interval_level: effective.sourceLevel,
    };
  });

  res.json(enriched);
});

// Create a new source
sourcesRouter.post('/', async (req, res) => {
  const parsed = sourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'اطلاعات ورودی نامعتبر است.', details: parsed.error.issues });
  }

  const data = parsed.data;
  let cleanValue = data.value.trim();

  // Validate format by type
  if (data.type === 'account') {
    cleanValue = cleanValue.replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,15}$/.test(cleanValue)) {
      return res.status(400).json({ error: 'نام کاربری نامعتبر است. فقط حروف انگلیسی، اعداد و _ (حداکثر ۱۵ کاراکتر) مجاز است.' });
    }
  } else if (data.type === 'hashtag') {
    cleanValue = cleanValue.replace(/^#/, '');
    if (/\s/.test(cleanValue)) {
      return res.status(400).json({ error: 'هشتگ نمی‌تواند دارای فاصله باشد.' });
    }
  }

  const id = `src-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  // Check if provider has economy defaults
  let maxResults = data.max_results || 20;
  let intervalMinutes = data.interval_minutes;
  let excludeRetweets = data.exclude_retweets ?? 0;
  let excludeReplies = data.exclude_replies ?? 0;
  let dailyCap = data.daily_cap ?? 100;

  if (data.provider === 'x-official') {
    intervalMinutes = intervalMinutes || 60;
    maxResults = Math.min(maxResults, 10);
    excludeRetweets = 1;
    excludeReplies = 1;
    if (data.type === 'hashtag' || data.type === 'keyword') {
      dailyCap = 50;
    }
  }

  // Pre-calculate initial next_poll_at
  const initialSource: SourceEntity = {
    id,
    type: data.type,
    value: cleanValue,
    interval_minutes: intervalMinutes,
    cron_expr: data.cron_expr,
    active_hours_json: data.active_hours_json,
    off_hours_mode: data.off_hours_mode,
    off_hours_interval_minutes: data.off_hours_interval_minutes,
    provider: data.provider,
    use_timeline_fallback: data.use_timeline_fallback,
    display_name: data.display_name || cleanValue,
    group_id: data.group_id,
    color: data.color || '#38bdf8',
    priority: data.priority || 3,
    enabled: data.enabled ?? 1,
    max_results: maxResults,
    daily_cap: dailyCap,
    exclude_retweets: excludeRetweets,
    exclude_replies: excludeReplies,
    lang: data.lang,
    ai_enabled: data.ai_enabled ?? 1,
    created_at: now,
  };

  const nextPoll = scheduler.calculateNextPoll(initialSource, data.provider || 'twscrape');

  db.prepare(`
    INSERT INTO sources (
      id, type, value, interval_minutes, cron_expr, active_hours_json,
      off_hours_mode, off_hours_interval_minutes, provider, use_timeline_fallback,
      display_name, group_id, color, priority, enabled, max_results, daily_cap,
      exclude_retweets, exclude_replies, lang, ai_enabled, next_poll_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    data.type,
    cleanValue,
    intervalMinutes || null,
    data.cron_expr || null,
    data.active_hours_json || null,
    data.off_hours_mode || 'pause',
    data.off_hours_interval_minutes || 180,
    data.provider || null,
    data.use_timeline_fallback ?? 0,
    data.display_name || cleanValue,
    data.group_id || null,
    data.color || '#38bdf8',
    data.priority || 3,
    data.enabled ?? 1,
    maxResults,
    dailyCap,
    excludeRetweets,
    excludeReplies,
    data.lang || null,
    data.ai_enabled ?? 1,
    nextPoll,
    now
  );

  res.json({ ok: true, id, message: 'منبع با موفقیت اضافه شد.' });
});

// Bulk import
sourcesRouter.post('/bulk', (req, res) => {
  const { text, type, group_id, provider } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'متن ورودی الزامی است.' });
  }

  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  const stmt = db.prepare(`
    INSERT INTO sources (id, type, value, display_name, group_id, provider, next_poll_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  const now = new Date();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let val = raw;
    let t = type || 'account';

    if (val.startsWith('@')) {
      t = 'account';
      val = val.slice(1);
    } else if (val.startsWith('#')) {
      t = 'hashtag';
      val = val.slice(1);
    }

    if (!val) continue;

    const id = `src-bulk-${Date.now()}-${i}-${crypto.randomBytes(3).toString('hex')}`;
    const nextPoll = new Date(now.getTime() + (i + 1) * 20000).toISOString(); // Stagger by 20s
    try {
      stmt.run(id, t, val, val, group_id || null, provider || null, nextPoll, now.toISOString());
      added++;
    } catch {}
  }

  res.json({ ok: true, count: added, message: `${added} منبع با موفقیت به سیستم افزوده شد.` });
});

// Update source
sourcesRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const parsed = sourceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'اطلاعات نامعتبر است.', details: parsed.error.issues });
  }

  const s = parsed.data;
  const existing = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceEntity | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'منبع مورد نظر یافت نشد.' });
  }

  db.prepare(`
    UPDATE sources SET
      display_name = COALESCE(?, display_name),
      interval_minutes = ?,
      cron_expr = ?,
      active_hours_json = ?,
      off_hours_mode = COALESCE(?, off_hours_mode),
      off_hours_interval_minutes = COALESCE(?, off_hours_interval_minutes),
      provider = ?,
      use_timeline_fallback = COALESCE(?, use_timeline_fallback),
      group_id = ?,
      color = COALESCE(?, color),
      priority = COALESCE(?, priority),
      enabled = COALESCE(?, enabled),
      max_results = COALESCE(?, max_results),
      daily_cap = COALESCE(?, daily_cap),
      exclude_retweets = COALESCE(?, exclude_retweets),
      exclude_replies = COALESCE(?, exclude_replies),
      lang = ?,
      ai_enabled = COALESCE(?, ai_enabled)
    WHERE id = ?
  `).run(
    s.display_name ?? null,
    s.interval_minutes !== undefined ? s.interval_minutes : (existing.interval_minutes ?? null),
    s.cron_expr !== undefined ? s.cron_expr : (existing.cron_expr ?? null),
    s.active_hours_json !== undefined ? s.active_hours_json : (existing.active_hours_json ?? null),
    s.off_hours_mode ?? null,
    s.off_hours_interval_minutes ?? null,
    s.provider !== undefined ? s.provider : (existing.provider ?? null),
    s.use_timeline_fallback ?? null,
    s.group_id !== undefined ? s.group_id : (existing.group_id ?? null),
    s.color ?? null,
    s.priority ?? null,
    s.enabled ?? null,
    s.max_results ?? null,
    s.daily_cap ?? null,
    s.exclude_retweets ?? null,
    s.exclude_replies ?? null,
    s.lang !== undefined ? s.lang : (existing.lang ?? null),
    s.ai_enabled ?? null,
    id
  );

  res.json({ ok: true, message: 'منبع با موفقیت به‌روزرسانی شد.' });
});

// Delete source
sourcesRouter.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
  res.json({ ok: true, message: 'منبع با موفقیت حذف گردید.' });
});

// Manual poll now
sourcesRouter.post('/:id/poll-now', async (req, res) => {
  const { id } = req.params;
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceEntity | undefined;
  if (!source) {
    return res.status(404).json({ error: 'منبع یافت نشد.' });
  }

  const result = await scheduler.pollSource(source, true);
  if (!result.success) {
    return res.status(500).json({ error: result.error || 'خطا در اجرای پایش دستی' });
  }

  res.json({ ok: true, newPostsCount: result.newPostsCount, message: `پایش انجام شد. ${result.newPostsCount} پست جدید اضافه شد.` });
});

// Dry run
sourcesRouter.get('/:id/dry-run', (req, res) => {
  const { id } = req.params;
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceEntity | undefined;
  if (!source) {
    return res.status(404).json({ error: 'منبع یافت نشد.' });
  }

  const effective = scheduler.calculateEffectiveInterval(source);
  const pollsPerDay = Math.floor((24 * 60) / Math.max(effective.intervalMinutes, 1));
  const pollsPerMonth = pollsPerDay * 30;
  const estimatedPostsPerPoll = Math.min(source.max_results || 10, 15);

  // X Official estimate
  const xCostPerPost = 0.005;
  const xMonthly = pollsPerMonth * estimatedPostsPerPoll * xCostPerPost;
  const xEndpoint = source.type === 'account' ? 'GET https://api.x.com/2/users/:id/tweets' : 'GET https://api.x.com/2/tweets/search/recent';

  // twitterapi.io estimate
  const twCostPerPost = 0.00015;
  const twMonthly = pollsPerMonth * estimatedPostsPerPoll * twCostPerPost;
  const twEndpoint = 'GET https://api.twitterapi.io/twitter/tweet/advanced_search';

  res.json({
    source: {
      id: source.id,
      value: source.value,
      type: source.type,
      intervalMinutes: effective.intervalMinutes,
      pollsPerMonth,
      estimatedPostsPerPoll,
    },
    officialX: {
      endpoint: xEndpoint,
      query: source.type === 'account' ? `user_id=${source.x_user_id || ':resolved_id'}&exclude=retweets,replies` : `query=${encodeURIComponent(source.value)}`,
      auth: 'Bearer [REDACTED_X_BEARER_TOKEN]',
      estimatedMonthlyUsd: Number(xMonthly.toFixed(2)),
    },
    twitterApiIo: {
      endpoint: twEndpoint,
      query: source.type === 'account' ? `from:${source.value} since_time:<unix>` : `${source.value} since_time:<unix>`,
      auth: 'X-API-Key: [REDACTED_TWITTERAPI_IO_KEY]',
      estimatedMonthlyUsd: Number(twMonthly.toFixed(3)),
    },
    freeProviders: {
      twscrape: { cost: 0, note: 'رایگان (نیازمند حساب اختصاصی در تنظیمات)' },
      nitterRss: { cost: 0, note: 'رایگان (فید RSS)' },
    },
  });
});

// Groups routes
sourcesRouter.get('/groups/all', (_req, res) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY name ASC').all();
  res.json(groups);
});

sourcesRouter.post('/groups', (req, res) => {
  const { name, color, default_interval_minutes, active_hours_json } = req.body;
  if (!name) return res.status(400).json({ error: 'نام گروه الزامی است.' });

  const id = `grp-${Date.now()}`;
  db.prepare(`
    INSERT INTO groups (id, name, color, default_interval_minutes, active_hours_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, color || '#06b6d4', default_interval_minutes || 30, active_hours_json || null, new Date().toISOString());

  res.json({ ok: true, id, message: 'گروه جدید ایجاد شد.' });
});

sourcesRouter.delete('/groups/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  res.json({ ok: true, message: 'گروه حذف شد.' });
});
