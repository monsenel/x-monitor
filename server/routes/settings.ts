import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/index.ts';
import { sseManager } from '../scheduler/sse.ts';
import { testAiConnection } from '../ai/gemini.ts';

export const settingsRouter = Router();

// Get all settings
settingsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json(settings);
});

// Update settings
settingsRouter.put('/', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'اطلاعات ارسالی نامعتبر است.' });
  }

  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  for (const [k, v] of Object.entries(updates)) {
    stmt.run(k, String(v), new Date().toISOString());
  }

  sseManager.broadcast('settings_updated', updates);
  res.json({ ok: true, message: 'تنظیمات با موفقیت ذخیره شد.' });
});

// Toggle global pause
settingsRouter.post('/toggle-global-pause', (req, res) => {
  const current = db.prepare("SELECT value FROM settings WHERE key = 'global_polling_paused'").get() as any;
  const newVal = current?.value === '1' ? '0' : '1';

  db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'global_polling_paused'").run(
    newVal,
    new Date().toISOString()
  );

  sseManager.broadcast('polling_status', { paused: newVal === '1' });
  res.json({ ok: true, paused: newVal === '1' });
});

// Test AI Connection
settingsRouter.post('/test-ai', async (req, res) => {
  try {
    const result = await testAiConnection(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message || 'خطا در آزمون اتصال هوش مصنوعی' });
  }
});

// Clean up old unbookmarked posts (retention)
settingsRouter.post('/retention-cleanup', (_req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'retention_days'").get() as any;
  const days = parseInt(row?.value || '30', 10);
  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();

  const info = db.prepare(`
    DELETE FROM posts
    WHERE created_at < ? AND is_bookmarked = 0
  `).run(cutoff);

  res.json({ ok: true, deletedCount: info.changes, message: `${info.changes} پست قدیمی‌تر از ${days} روز پاکسازی شد.` });
});

// Download DB backup
settingsRouter.get('/backup', (_req, res) => {
  const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'xmonitor.db');
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'فایل دیتابیس یافت نشد.' });
  }

  res.setHeader('Content-Disposition', 'attachment; filename="xmonitor_backup.db"');
  res.setHeader('Content-Type', 'application/octet-stream');
  const stream = fs.createReadStream(dbPath);
  stream.pipe(res);
});
