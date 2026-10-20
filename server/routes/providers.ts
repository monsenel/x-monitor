import { Router } from 'express';
import { providerRegistry } from '../providers/index.ts';
import { db } from '../db/index.ts';

export const providersRouter = Router();

providersRouter.get('/', (_req, res) => {
  const defaultProvider = db.prepare("SELECT value FROM settings WHERE key = 'default_provider'").get() as any;
  const providers = providerRegistry.getAll().map((p) => {
    let configured = true;
    if (p.id === 'x-official') {
      configured = !!process.env.X_BEARER_TOKEN;
    } else if (p.id === 'twitterapi-io') {
      configured = !!process.env.TWITTERAPI_IO_KEY;
    }

    return {
      id: p.id,
      name: p.name,
      isFree: p.isFree,
      requiresKey: p.requiresKey,
      configured,
      isDefault: defaultProvider?.value === p.id,
    };
  });

  res.json(providers);
});

// Test connection
providersRouter.post('/:id/test', async (req, res) => {
  const { id } = req.params;
  const result = await providerRegistry.checkProviderHealth(id);
  res.json(result);
});

// Get prices, budgets, and floors configuration
providersRouter.get('/config', (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'price_%' OR key LIKE 'budget_%' OR key LIKE 'floor_%' OR key = 'default_provider'").all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const r of rows) {
    config[r.key] = r.value;
  }
  res.json(config);
});

providersRouter.put('/config', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'اطلاعات نامعتبر است.' });
  }

  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  for (const [k, v] of Object.entries(updates)) {
    stmt.run(k, String(v), new Date().toISOString());
  }

  res.json({ ok: true, message: 'تنظیمات با موفقیت ذخیره شد.' });
});
