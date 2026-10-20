import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/index.ts';

export const alertsRouter = Router();

const ruleSchema = z.object({
  name: z.string().min(1),
  enabled: z.number().optional(),
  source_id: z.string().nullable().optional(),
  keyword: z.string().nullable().optional(),
  min_importance: z.number().nullable().optional(),
  min_likes: z.number().nullable().optional(),
  channel_telegram: z.number().optional(),
  channel_inapp: z.number().optional(),
  channel_push: z.number().optional(),
  cooldown_minutes: z.number().min(1).optional(),
});

// List rules
alertsRouter.get('/rules', (_req, res) => {
  const rules = db.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC').all();
  res.json(rules);
});

// Create rule
alertsRouter.post('/rules', (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'اطلاعات قانون نامعتبر است.', details: parsed.error.issues });
  }

  const d = parsed.data;
  const id = `rule-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  db.prepare(`
    INSERT INTO alert_rules (
      id, name, enabled, source_id, keyword, min_importance, min_likes,
      channel_telegram, channel_inapp, channel_push, cooldown_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    d.name,
    d.enabled ?? 1,
    d.source_id || null,
    d.keyword || null,
    d.min_importance || null,
    d.min_likes || null,
    d.channel_telegram ?? 0,
    d.channel_inapp ?? 1,
    d.channel_push ?? 0,
    d.cooldown_minutes || 30,
    new Date().toISOString()
  );

  res.json({ ok: true, id, message: 'قانون هشدار با موفقیت ثبت شد.' });
});

// Update rule
alertsRouter.put('/rules/:id', (req, res) => {
  const { id } = req.params;
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'اطلاعات نامعتبر است.' });
  }

  const d = parsed.data;
  db.prepare(`
    UPDATE alert_rules SET
      name = COALESCE(?, name),
      enabled = COALESCE(?, enabled),
      source_id = ?,
      keyword = ?,
      min_importance = ?,
      min_likes = ?,
      channel_telegram = COALESCE(?, channel_telegram),
      channel_inapp = COALESCE(?, channel_inapp),
      channel_push = COALESCE(?, channel_push),
      cooldown_minutes = COALESCE(?, cooldown_minutes)
    WHERE id = ?
  `).run(
    d.name ?? null,
    d.enabled ?? null,
    d.source_id !== undefined ? d.source_id : null,
    d.keyword !== undefined ? d.keyword : null,
    d.min_importance !== undefined ? d.min_importance : null,
    d.min_likes !== undefined ? d.min_likes : null,
    d.channel_telegram ?? null,
    d.channel_inapp ?? null,
    d.channel_push ?? null,
    d.cooldown_minutes ?? null,
    id
  );

  res.json({ ok: true, message: 'قانون هشدار به‌روزرسانی شد.' });
});

// Delete rule
alertsRouter.delete('/rules/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
  res.json({ ok: true, message: 'قانون هشدار حذف گردید.' });
});

// List alert logs
alertsRouter.get('/logs', (_req, res) => {
  const logs = db.prepare('SELECT * FROM alert_log ORDER BY created_at DESC LIMIT 100').all();
  res.json(logs);
});
