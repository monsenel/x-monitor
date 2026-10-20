import { Router } from 'express';
import { db } from '../db/index.ts';
import { scheduler } from '../scheduler/poller.ts';
import type { SourceEntity } from '../providers/types.ts';

export const schedulerRouter = Router();

schedulerRouter.get('/queue', (_req, res) => {
  const isPaused = (db.prepare("SELECT value FROM settings WHERE key = 'global_polling_paused'").get() as any)?.value === '1';

  const rows = db.prepare(`
    SELECT s.*, g.name as group_name
    FROM sources s
    LEFT JOIN groups g ON s.group_id = g.id
    WHERE s.enabled = 1
    ORDER BY s.next_poll_at ASC
  `).all() as unknown as (SourceEntity & { group_name?: string })[];

  const queue = rows.map((s) => {
    const effective = scheduler.calculateEffectiveInterval(s);
    const nextPollTime = s.next_poll_at ? new Date(s.next_poll_at).getTime() : 0;
    const nowTime = Date.now();
    const remainingSeconds = Math.max(Math.floor((nextPollTime - nowTime) / 1000), 0);

    return {
      id: s.id,
      value: s.value,
      type: s.type,
      provider: s.provider || 'twscrape (پیش‌فرض)',
      groupName: s.group_name,
      lastPolledAt: s.last_polled_at,
      nextPollAt: s.next_poll_at,
      remainingSeconds,
      lastError: s.last_error,
      consecutiveFailures: s.consecutive_failures || 0,
      effectiveIntervalMinutes: effective.intervalMinutes,
      effectiveLevel: effective.sourceLevel,
    };
  });

  res.json({
    isPaused,
    queue,
  });
});
