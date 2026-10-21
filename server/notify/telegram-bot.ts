import { getTelegramConfig, escapeHtml } from './telegram.ts';

// Minimal long-polling listener so users can ask the bot for their chat ID (/id).
// Works behind NAT (no public webhook needed). The token is re-read from the
// admin-panel settings on every loop, so changes apply without a restart.

interface TgChat { id: number; type: string; title?: string; username?: string; first_name?: string; last_name?: string }
interface TgMessage { text?: string; chat: TgChat; from?: { id: number; username?: string; first_name?: string; last_name?: string } }

const COMMANDS = [
  { command: 'id', description: 'نمایش شناسه عددی چت/کاربر' },
  { command: 'start', description: 'شروع و راهنما' },
];

// "/id", "/id@MyBot", "/start foo" -> "id" / "start"; anything else -> null
export function parseCommand(text: string | undefined): string | null {
  const m = (text || '').trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i);
  return m ? m[1].toLowerCase() : null;
}

export function buildIdReply(msg: TgMessage): string {
  const { chat, from } = msg;
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ');
  const lines = ['🆔 <b>اطلاعات شما</b>', ''];
  if (name) lines.push(`👤 نام: ${escapeHtml(name)}`);
  if (from?.username) lines.push(`🔗 نام کاربری: @${escapeHtml(from.username)}`);
  if (from) lines.push(`🔢 شناسه کاربر: <code>${from.id}</code>`);
  if (chat.type !== 'private') {
    lines.push('', `💬 این ${chat.type === 'channel' ? 'کانال' : 'گروه'}${chat.title ? ` («${escapeHtml(chat.title)}»)` : ''}`);
    lines.push(`🔢 شناسه چت: <code>${chat.id}</code>`);
  }
  lines.push('', 'این عدد را در پنل X Monitor ← تنظیمات ← اعلان‌های تلگرام در بخش «شناسه گیرنده‌ها» وارد کنید.');
  return lines.join('\n');
}

async function api(token: string, method: string, body: Record<string, unknown>, timeoutMs = 15000): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const err: any = new Error(json.description || `HTTP ${res.status}`);
    err.code = json.error_code || res.status;
    throw err;
  }
  return json.result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startTelegramBot(): void {
  let offset = 0;
  let registeredFor = '';
  let lastLoggedError = '';

  const loop = async () => {
    for (;;) {
      const cfg = getTelegramConfig();
      if (!cfg.enabled || !cfg.token) {
        registeredFor = '';
        await sleep(10000);
        continue;
      }
      const token = cfg.token;
      try {
        if (registeredFor !== token) {
          await api(token, 'setMyCommands', { commands: COMMANDS });
          registeredFor = token;
          offset = 0;
        }
        const updates: { update_id: number; message?: TgMessage }[] = await api(
          token, 'getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 35000,
        );
        for (const u of updates) {
          offset = u.update_id + 1;
          const cmd = parseCommand(u.message?.text);
          if (!u.message || (cmd !== 'id' && cmd !== 'start')) continue;
          await api(token, 'sendMessage', {
            chat_id: u.message.chat.id,
            text: buildIdReply(u.message),
            parse_mode: 'HTML',
          }).catch(() => {});
        }
        lastLoggedError = '';
      } catch (err: any) {
        const msg = String(err?.message || err).split(token).join('***');
        if (msg !== lastLoggedError) {
          console.error('[TelegramBot] polling error:', msg);
          lastLoggedError = msg;
        }
        // 401: bad token, 409: webhook/another poller — back off longer
        await sleep(err?.code === 401 || err?.code === 409 ? 60000 : 5000);
      }
    }
  };

  loop().catch((err) => console.error('[TelegramBot] stopped:', err));
}
