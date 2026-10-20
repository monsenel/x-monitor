import { Router } from 'express';
import { z } from 'zod';
import { getSidecarUrl } from '../providers/twscrape.ts';
import { db } from '../db/index.ts';

export const scraperRouter = Router();

const SIDECAR_SECRET = process.env.SIDECAR_SHARED_SECRET || 'xmonitor-internal-secret-change-me';

const addAccountSchema = z.object({
  username: z.string().min(1),
  auth_token: z.string().min(1),
  ct0: z.string().min(1),
});

function getLocalScraperAccounts() {
  const rows = db.prepare('SELECT username, active, last_error, locks_json FROM scraper_accounts ORDER BY created_at DESC').all() as {
    username: string;
    active: number;
    last_error?: string;
    locks_json?: string;
  }[];

  return rows.map((r) => {
    let locks: string[] = [];
    try {
      locks = r.locks_json ? JSON.parse(r.locks_json) : [];
    } catch {}
    return {
      username: r.username,
      active: !!r.active,
      last_error: r.last_error || undefined,
      locks,
    };
  });
}

// List scraper accounts from sidecar (or embedded SQLite fallback)
scraperRouter.get('/accounts', async (_req, res) => {
  const sidecarUrl = getSidecarUrl().replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${sidecarUrl}/accounts`, {
      headers: {
        'X-Sidecar-Secret': SIDECAR_SECRET,
      },
      signal: controller.signal,
    });
    clearTimeout(t);

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch {}

  return res.json({ accounts: getLocalScraperAccounts(), embedded: true });
});

// Add account (write-only cookies sent to sidecar or stored in local pool)
scraperRouter.post('/accounts', async (req, res) => {
  const parsed = addAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'نام کاربری و کوکی‌های auth_token و ct0 الزامی هستند.' });
  }

  const { username, auth_token, ct0 } = parsed.data;
  const cleanUser = username.replace(/^@/, '');

  try {
    const sidecarUrl = getSidecarUrl().replace(/\/$/, '');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${sidecarUrl}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sidecar-Secret': SIDECAR_SECRET,
      },
      body: JSON.stringify({
        username: cleanUser,
        auth_token,
        ct0,
      }),
      signal: controller.signal,
    });
    clearTimeout(t);

    if (response.ok) {
      const data = await response.json();
      return res.json({ ok: true, message: 'حساب اختصاصی با موفقیت به اسکرپر افزوده شد.', data });
    }
  } catch {}

  db.prepare(`
    INSERT INTO scraper_accounts (username, auth_token, ct0, active, created_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(username) DO UPDATE SET
      auth_token = excluded.auth_token,
      ct0 = excluded.ct0,
      active = 1,
      last_error = NULL
  `).run(cleanUser, auth_token, ct0, new Date().toISOString());

  return res.json({ ok: true, message: 'حساب اختصاصی با موفقیت به اسکرپر داخلی افزوده شد.' });
});

// Delete account from sidecar (and local pool)
scraperRouter.delete('/accounts/:username', async (req, res) => {
  const { username } = req.params;
  const cleanUser = username.replace(/^@/, '');

  try {
    const sidecarUrl = getSidecarUrl().replace(/\/$/, '');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    await fetch(`${sidecarUrl}/accounts/${encodeURIComponent(cleanUser)}`, {
      method: 'DELETE',
      headers: {
        'X-Sidecar-Secret': SIDECAR_SECRET,
      },
      signal: controller.signal,
    });
    clearTimeout(t);
  } catch {}

  db.prepare('DELETE FROM scraper_accounts WHERE username = ?').run(cleanUser);
  res.json({ ok: true, message: `حساب @${cleanUser} با موفقیت از اسکرپر حذف شد.` });
});

