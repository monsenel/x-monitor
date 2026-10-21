import { db } from '../db/index.ts';

const TG_MAX_LEN = 4096;

export interface TelegramConfig {
  enabled: boolean;
  token: string;
  chatIds: string[];
  sendDigests: boolean;
}

export interface TelegramSendResult {
  ok: boolean;
  sent: number;
  failed: { chatId: string; error: string }[];
}

function getSetting(key: string): string {
  return ((db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value as string) || '';
}

// Accepts commas, whitespace or newlines as separators; de-duplicates.
export function parseChatIds(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));
}

// Panel settings win; env vars remain as a fallback for older deployments.
export function getTelegramConfig(): TelegramConfig {
  const token = getSetting('telegram_bot_token') || process.env.TELEGRAM_BOT_TOKEN || '';
  const chatIds = parseChatIds(getSetting('telegram_chat_ids') || process.env.TELEGRAM_CHAT_ID || '');
  return {
    enabled: getSetting('telegram_enabled') !== '0',
    token,
    chatIds,
    sendDigests: getSetting('telegram_send_digests') !== '0',
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Splits on line boundaries so each chunk fits Telegram's message limit.
export function splitMessage(text: string, max = TG_MAX_LEN): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > max && current) {
      chunks.push(current);
      current = '';
    }
    let rest = line;
    while (rest.length > max) {
      chunks.push(rest.slice(0, max));
      rest = rest.slice(max);
    }
    current = current ? current + '\n' + rest : rest;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendToChat(token: string, chatId: string, html: string): Promise<void> {
  for (const chunk of splitMessage(html)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      let desc = await res.text();
      try { desc = JSON.parse(desc).description || desc; } catch { /* keep raw */ }
      throw new Error(desc);
    }
  }
}

// `html` must already be escaped; only <b>, <i>, <a href> tags are intended.
export async function sendTelegram(html: string, override?: Partial<Pick<TelegramConfig, 'token' | 'chatIds'>>): Promise<TelegramSendResult> {
  const cfg = getTelegramConfig();
  const token = override?.token ?? cfg.token;
  const chatIds = override?.chatIds ?? cfg.chatIds;

  if (!token || chatIds.length === 0) {
    return { ok: false, sent: 0, failed: [{ chatId: '-', error: 'توکن ربات یا شناسه چت‌ها در تنظیمات وارد نشده است.' }] };
  }

  const failed: { chatId: string; error: string }[] = [];
  let sent = 0;
  for (const chatId of chatIds) {
    try {
      await sendToChat(token, chatId, html);
      sent++;
    } catch (err: any) {
      // Never leak the token through error messages
      failed.push({ chatId, error: String(err?.message || err).split(token).join('***') });
    }
  }
  return { ok: failed.length === 0, sent, failed };
}

export function formatDigestForTelegram(
  digest: { title: string; content: string; groupSummaries?: Record<string, string> },
  topPosts: { author: string; text: string; url: string }[],
): string {
  const lines: string[] = [`📰 <b>${escapeHtml(digest.title)}</b>`, '', escapeHtml(digest.content)];

  const groups = Object.entries(digest.groupSummaries || {});
  if (groups.length > 0) {
    lines.push('');
    for (const [name, summary] of groups) {
      lines.push(`📂 <b>${escapeHtml(name)}</b>`, escapeHtml(String(summary)), '');
    }
  }

  if (topPosts.length > 0) {
    lines.push('', '⭐ <b>پست‌های برگزیده</b>');
    for (const p of topPosts) {
      const text = p.text.replace(/\s+/g, ' ').trim();
      const snippet = text.length > 500 ? text.slice(0, 500) + '…' : text;
      lines.push(`• @${escapeHtml(p.author.replace(/^@/, ''))}: ${escapeHtml(snippet)} <a href="${escapeHtml(p.url)}">🔗</a>`);
    }
  }
  return lines.join('\n').trim();
}

export async function sendDigestToTelegram(digest: { title: string; content: string; topPosts: string[]; groupSummaries: Record<string, string> }): Promise<TelegramSendResult | null> {
  const cfg = getTelegramConfig();
  if (!cfg.enabled || !cfg.sendDigests || !cfg.token || cfg.chatIds.length === 0) return null;

  let topPosts: { author: string; text: string; url: string }[] = [];
  if (digest.topPosts?.length) {
    const ids = digest.topPosts.slice(0, 5);
    topPosts = db.prepare(
      `SELECT author_username as author, text, url FROM posts WHERE x_post_id IN (${ids.map(() => '?').join(',')})`,
    ).all(...ids) as any[];
  }
  return sendTelegram(formatDigestForTelegram(digest, topPosts));
}
