import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { syncNitterSessionsFile, parseTwid } from '../nitter/sessions.ts';

export const nitterRouter = Router();

const addSchema = z.object({
  username: z.string().trim().min(1).transform((u) => u.replace(/^@/, '')),
  twid: z.string().trim().min(1),
  auth_token: z.string().trim().min(1),
  ct0: z.string().trim().min(1),
});

// List sessions (secrets are never returned)
nitterRouter.get('/sessions', (_req, res) => {
  const rows = db.prepare('SELECT username, user_id, created_at FROM nitter_sessions ORDER BY created_at DESC').all();
  res.json({ sessions: rows });
});

nitterRouter.post('/sessions', (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'نام کاربری، twid، auth_token و ct0 الزامی هستند.' });
  }
  const { username, twid, auth_token, ct0 } = parsed.data;
  const userId = parseTwid(twid);
  if (!userId) {
    return res.status(400).json({ error: 'مقدار twid نامعتبر است (باید شامل شناسه عددی کاربر باشد).' });
  }

  db.prepare(`
    INSERT INTO nitter_sessions (username, user_id, auth_token, ct0, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET user_id = excluded.user_id, auth_token = excluded.auth_token, ct0 = excluded.ct0
  `).run(username, userId, auth_token, ct0, new Date().toISOString());

  syncNitterSessionsFile();
  res.json({ ok: true, message: 'نشست ذخیره شد. Nitter ظرف چند ثانیه خودکار راه‌اندازی مجدد می‌شود.' });
});

nitterRouter.delete('/sessions/:username', (req, res) => {
  db.prepare('DELETE FROM nitter_sessions WHERE username = ?').run(req.params.username);
  syncNitterSessionsFile();
  res.json({ ok: true });
});

// Is the local Nitter container reachable and serving RSS?
nitterRouter.get('/status', async (_req, res) => {
  const base = (process.env.NITTER_LOCAL_URL || 'http://nitter:8080').replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/jack/rss`, { signal: AbortSignal.timeout(8000) });
    res.json({ ok: r.ok, status: r.status, url: base });
  } catch (err: any) {
    res.json({ ok: false, status: 0, url: base, error: err.message });
  }
});
