import { db } from '../db/index.ts';
import { sseManager } from '../scheduler/sse.ts';
import { getTelegramConfig, sendTelegram, escapeHtml } from '../notify/telegram.ts';
import type { NormalizedPost } from '../providers/types.ts';

export interface AlertRule {
  id: string;
  name: string;
  enabled: number;
  source_id?: string | null;
  keyword?: string | null;
  min_importance?: number | null;
  min_likes?: number | null;
  channel_telegram: number;
  channel_inapp: number;
  channel_push: number;
  cooldown_minutes: number;
  last_triggered_at?: string | null;
}

export class AlertEngine {
  async processNewPosts(posts: NormalizedPost[], sourceId: string) {
    if (posts.length === 0) return;

    const rules = db.prepare('SELECT * FROM alert_rules WHERE enabled = 1').all() as unknown as AlertRule[];
    if (rules.length === 0) return;

    for (const post of posts) {
      for (const rule of rules) {
        if (this.matchesRule(rule, post, sourceId)) {
          if (this.isInCooldown(rule)) continue;
          await this.triggerAlert(rule, post);
        }
      }
    }
  }

  private matchesRule(rule: AlertRule, post: NormalizedPost, sourceId: string): boolean {
    if (rule.source_id && rule.source_id !== sourceId) {
      return false;
    }
    if (rule.keyword && !post.text.toLowerCase().includes(rule.keyword.toLowerCase())) {
      return false;
    }
    if (rule.min_likes && (post.metrics.likes || 0) < rule.min_likes) {
      return false;
    }
    return true;
  }

  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.last_triggered_at) return false;
    const last = new Date(rule.last_triggered_at).getTime();
    const cooldownMs = (rule.cooldown_minutes || 30) * 60 * 1000;
    return Date.now() - last < cooldownMs;
  }

  private async triggerAlert(rule: AlertRule, post: NormalizedPost) {
    const title = `هشدار پایش: ${rule.name}`;
    const message = `پست جدید از @${post.authorUsername}: ${post.text.slice(0, 150)}...`;

    // 1. In-App Alert
    if (rule.channel_inapp) {
      db.prepare(`
        INSERT INTO alert_log (rule_id, post_id, channel, title, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(rule.id, post.id, 'inapp', title, message, 'sent', new Date().toISOString());

      sseManager.broadcast('alert', {
        ruleId: rule.id,
        ruleName: rule.name,
        postId: post.id,
        title,
        message,
        url: post.url,
      });
    }

    // 2. Telegram Alert
    if (rule.channel_telegram) {
      await this.sendTelegramAlert(rule.id, post, title, message);
    }

    // Update rule last_triggered_at
    db.prepare('UPDATE alert_rules SET last_triggered_at = ? WHERE id = ?').run(new Date().toISOString(), rule.id);
  }

  private async sendTelegramAlert(ruleId: string, post: NormalizedPost, title: string, message: string) {
    const cfg = getTelegramConfig();
    if (!cfg.enabled) return;

    const html = `🔔 <b>${escapeHtml(title)}</b>\n\n👤 <b>نویسنده:</b> @${escapeHtml(post.authorUsername)}\n📝 <b>متن:</b> ${escapeHtml(post.text)}\n🔗 <a href="${escapeHtml(post.url)}">مشاهده در توییتر</a>`;
    const result = await sendTelegram(html);

    const error = result.failed.map((f) => `${f.chatId}: ${f.error}`).join(' | ');
    db.prepare(`
      INSERT INTO alert_log (rule_id, post_id, channel, title, message, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ruleId, post.id, 'telegram', title, message, result.sent > 0 ? 'sent' : 'failed', error || null, new Date().toISOString());
  }
}

export const alertEngine = new AlertEngine();
