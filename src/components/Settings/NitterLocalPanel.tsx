import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { Server, Trash2, RefreshCw, Plus } from 'lucide-react';

interface Session {
  username: string;
  user_id: string;
  created_at: string;
}

export const NitterLocalPanel: React.FC = () => {
  const { t } = usePreferences();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState({ username: '', twid: '', auth_token: '', ct0: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      const res = await apiRequest<{ sessions: Session[] }>('/api/nitter/sessions');
      setSessions(res.sessions);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/nitter/sessions', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMsg({ ok: true, text: res.message });
      setForm({ username: '', twid: '', auth_token: '', ct0: '' });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (username: string) => {
    await apiRequest(`/api/nitter/sessions/${encodeURIComponent(username)}`, { method: 'DELETE' });
    load();
  };

  const checkStatus = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiRequest<{ ok: boolean; status: number; error?: string }>('/api/nitter/status');
      setMsg({
        ok: res.ok,
        text: res.ok
          ? t('Local Nitter is up and serving RSS.', 'Nitter محلی بالا است و RSS می‌دهد.')
          : t(
              `Local Nitter is not working yet (status ${res.status}${res.error ? ', ' + res.error : ''}). It needs a valid X account session; give it ~10 seconds after adding one.`,
              `Nitter محلی هنوز کار نمی‌کند (وضعیت ${res.status}${res.error ? '، ' + res.error : ''}). به نشست معتبر اکانت X نیاز دارد؛ بعد از افزودن حدود ۱۰ ثانیه صبر کنید.`
            ),
      });
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
        <Server className="w-4 h-4 text-cyan-400" />
        <span>{t('Local Nitter (Docker)', 'Nitter محلی (داکر)')}</span>
      </h3>

      <p className="text-xs text-slate-400 leading-relaxed">
        {t(
          'The bundled Nitter container needs a real X account. Paste the account cookies below (same ones used for twscrape: F12 → Application → Cookies → x.com). Nitter restarts automatically when you change them. Use a burner account.',
          'کانتینر Nitter داخلی به یک اکانت واقعی X نیاز دارد. کوکی‌های اکانت را اینجا وارد کنید (همان کوکی‌های twscrape: F12 ← Application ← Cookies ← x.com). با هر تغییر، Nitter خودکار راه‌اندازی مجدد می‌شود. از اکانت جانبی استفاده کنید.'
        )}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs" dir="ltr">
        <input className={input} placeholder="username (without @)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className={input} placeholder="twid cookie (u%3D123456789) or numeric user id" value={form.twid} onChange={(e) => setForm({ ...form, twid: e.target.value })} />
        <input className={input} type="password" placeholder="auth_token" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} />
        <input className={input} type="password" placeholder="ct0" value={form.ct0} onChange={(e) => setForm({ ...form, ct0: e.target.value })} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          onClick={add}
          disabled={busy || !form.username || !form.twid || !form.auth_token || !form.ct0}
          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('Add account', 'افزودن اکانت')}</span>
        </button>
        <button
          onClick={checkStatus}
          disabled={busy}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('Check Nitter status', 'بررسی وضعیت Nitter')}</span>
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl border text-xs ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {msg.text}
        </div>
      )}

      {sessions.length > 0 && (
        <ul className="divide-y divide-slate-800 text-xs">
          {sessions.map((s) => (
            <li key={s.username} className="flex items-center justify-between py-2">
              <span className="text-slate-200 font-mono" dir="ltr">
                @{s.username} <span className="text-slate-500">({s.user_id})</span>
              </span>
              <button onClick={() => remove(s.username)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
