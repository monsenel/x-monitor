import { Router } from 'express';
import { z } from 'zod';
import { getSidecarUrl } from '../providers/twscrape.ts';

export const scraperRouter = Router();

const SIDECAR_SECRET = process.env.SIDECAR_SHARED_SECRET || 'xmonitor-internal-secret-change-me';

const addAccountSchema = z.object({
  username: z.string().min(1),
  auth_token: z.string().min(1),
  ct0: z.string().min(1),
});

// List scraper accounts from sidecar
scraperRouter.get('/accounts', async (_req, res) => {
  const sidecarUrl = getSidecarUrl().replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${sidecarUrl}/accounts`, {
      headers: {
        'X-Sidecar-Secret': SIDECAR_SECRET,
      },
      signal: controller.signal,
    });
    clearTimeout(t);

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `سایدکار اسکرپر: ${err}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: `اتصال به سایدکار اسکرپر ممکن نشد: ${err.message}` });
  }
});

// Add account (write-only cookies sent directly to sidecar)
scraperRouter.post('/accounts', async (req, res) => {
  const parsed = addAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'نام کاربری و کوکی‌های auth_token و ct0 الزامی هستند.' });
  }

  const { username, auth_token, ct0 } = parsed.data;

  try {
    const sidecarUrl = getSidecarUrl().replace(/\/$/, '');
    const response = await fetch(`${sidecarUrl}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sidecar-Secret': SIDECAR_SECRET,
      },
      body: JSON.stringify({
        username: username.replace(/^@/, ''),
        auth_token,
        ct0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `خطا در ثبت حساب در اسکرپر: ${err}` });
    }

    const data = await response.json();
    res.json({ ok: true, message: 'حساب اختصاصی با موفقیت به اسکرپر افزوده شد.', data });
  } catch (err: any) {
    res.status(502).json({ error: `خطا در ارتباط با سرویس اسکرپر: ${err.message}` });
  }
});

// Delete account from sidecar
scraperRouter.delete('/accounts/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const sidecarUrl = getSidecarUrl().replace(/\/$/, '');
    const response = await fetch(`${sidecarUrl}/accounts/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: {
        'X-Sidecar-Secret': SIDECAR_SECRET,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    res.json({ ok: true, message: `حساب @${username} با موفقیت از اسکرپر حذف شد.` });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});
