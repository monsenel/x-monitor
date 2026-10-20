import React, { useState, useEffect } from 'react';
import { AlertRuleItem, AlertLogItem, Source } from '../../types.ts';
import { apiRequest } from '../../utils/api.ts';
import { toRelativeTimeFa, toPersianDigits } from '../../utils/date.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { Bell, Plus, Trash2, CheckCircle2, XCircle, Send, MessageSquare, X } from 'lucide-react';

export const AlertsView: React.FC = () => {
  const { t } = usePreferences();
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [logs, setLogs] = useState<AlertLogItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [minImportance, setMinImportance] = useState<number | ''>('');
  const [minLikes, setMinLikes] = useState<number | ''>('');
  const [channelTelegram, setChannelTelegram] = useState(false);
  const [channelInapp, setChannelInapp] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, l, s] = await Promise.all([
        apiRequest<AlertRuleItem[]>('/api/alerts/rules'),
        apiRequest<AlertLogItem[]>('/api/alerts/logs'),
        apiRequest<Source[]>('/api/sources'),
      ]);
      setRules(r);
      setLogs(l);
      setSources(s);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    try {
      await apiRequest('/api/alerts/rules', {
        method: 'POST',
        body: JSON.stringify({
          name,
          source_id: sourceId || null,
          keyword: keyword || null,
          min_importance: minImportance !== '' ? Number(minImportance) : null,
          min_likes: minLikes !== '' ? Number(minLikes) : null,
          channel_telegram: channelTelegram ? 1 : 0,
          channel_inapp: channelInapp ? 1 : 0,
          cooldown_minutes: cooldownMinutes,
        }),
      });
      setShowAddModal(false);
      setName('');
      setKeyword('');
      setStatusBanner({
        ok: true,
        message: t('Alert rule created successfully.', 'قانون هشدار جدید با موفقیت ثبت شد.'),
      });
      loadData();
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  const handleDeleteRule = async (id: string) => {
    setStatusBanner(null);
    try {
      await apiRequest(`/api/alerts/rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
      setStatusBanner({
        ok: true,
        message: t('Alert rule deleted.', 'قانون هشدار حذف شد.'),
      });
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  const handleToggleRule = async (rule: AlertRuleItem) => {
    const newVal = rule.enabled ? 0 : 1;
    try {
      await apiRequest(`/api/alerts/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: newVal }),
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: newVal } : r)));
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <span>{t('Alert Rules & Delivery History', 'قوانین و تاریخچه هشدارها (Alert Rules)')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'Trigger instant notifications to Telegram or in-app feed based on keywords, importance score, or engagement',
              'ارسال اعلان فوری به ربات تلگرام یا پنل برنامه بر مبنای کلیدواژه، امتیاز اهمیت یا میزان تعامل پست‌ها'
            )}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('New Alert Rule', 'تعریف قانون هشدار جدید')}</span>
        </button>
      </div>

      {statusBanner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            statusBanner.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{statusBanner.message}</span>
          <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white cursor-pointer">
            {t('Dismiss', 'بستن')}
          </button>
        </div>
      )}

      {/* Rules Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-200">
          {t('Active Rules', 'قوانین فعال')} ({toPersianDigits(rules.length)})
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {t('Loading alert rules...', 'در حال بارگذاری قوانین...')}
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            {t('No alert rules created yet.', 'هنوز قانون هشداری تعریف نکرده‌اید.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {rules.map((r) => (
              <div
                key={r.id}
                className={`bg-slate-900/60 border rounded-2xl p-4 space-y-3 transition-colors ${
                  r.enabled ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-100">{r.name}</h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleRule(r)}
                      className={`text-[10px] px-2 py-0.5 rounded font-medium border cursor-pointer ${
                        r.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {r.enabled ? t('Enabled', 'فعال') : t('Disabled', 'غیرفعال')}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Conditions summary */}
                <div className="space-y-1 text-xs text-slate-400">
                  {r.keyword && (
                    <div>
                      {t('Keyword:', 'کلیدواژه:')}{' '}
                      <span className="text-cyan-400 font-bold">{r.keyword}</span>
                    </div>
                  )}
                  {r.min_importance && (
                    <div>
                      {t('Min Importance:', 'حداقل اهمیت:')}{' '}
                      <span className="font-mono text-amber-400">
                        {toPersianDigits(r.min_importance)}/{toPersianDigits(10)}
                      </span>
                    </div>
                  )}
                  {r.min_likes && (
                    <div>
                      {t('Min Likes:', 'حداقل لایک:')}{' '}
                      <span className="font-mono text-rose-400">{toPersianDigits(r.min_likes)}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500">
                    {t('Cooldown:', 'کول‌داون (Cooldown):')} {toPersianDigits(r.cooldown_minutes)}{' '}
                    {t('min', 'دقیقه')}
                  </div>
                </div>

                {/* Channels */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-xs">
                  {r.channel_telegram ? (
                    <span className="flex items-center gap-1 text-sky-400">
                      <Send className="w-3 h-3" />
                      <span>{t('Telegram', 'تلگرام')}</span>
                    </span>
                  ) : null}
                  {r.channel_inapp ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <MessageSquare className="w-3 h-3" />
                      <span>{t('In-App', 'درون‌برنامه')}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Log */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200">
            {t('Alert Delivery History', 'تاریخچه ارسال هشدارها')}
          </h3>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {t('No alerts triggered yet.', 'تاکنون هشداری ثبت نشده است.')}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{log.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {log.channel === 'telegram' ? t('Telegram', 'تلگرام') : t('In-App', 'درون‌برنامه')}
                    </span>
                    {log.status === 'sent' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>
                  <p className="text-slate-400">{log.message}</p>
                  {log.error && (
                    <p className="text-[11px] text-rose-400">
                      {t('Error:', 'علت خطا:')} {log.error}
                    </p>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                  {toRelativeTimeFa(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {t('Create New Alert Rule', 'تعریف قانون هشدار جدید')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('Rule Name:', 'عنوان قانون:')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('e.g. Breaking AI Release', 'مثال: خبر فوری هوش مصنوعی')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('Limit to Specific Source (Optional):', 'محدود به منبع خاص (اختیاری):')}
                </label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">{t('All Sources', 'همه منابع')}</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name || s.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('Contains Keyword (Optional):', 'حاوی کلیدواژه خاص (اختیاری):')}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t('e.g. Grok or GPT-5 or launch', 'مثال: Grok یا GPT-5 یا انتشار')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {t('Min Importance Score (0-10):', 'حداقل امتیاز اهمیت (۰-۱۰):')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={minImportance}
                    onChange={(e) => setMinImportance(e.target.value ? Number(e.target.value) : '')}
                    placeholder={t('e.g. 8', 'مثال: 8')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {t('Minimum Likes:', 'حداقل لایک:')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minLikes}
                    onChange={(e) => setMinLikes(e.target.value ? Number(e.target.value) : '')}
                    placeholder={t('e.g. 1000', 'مثال: 1000')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('Delivery Channels:', 'کانال‌های ارسال:')}
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={channelInapp}
                      onChange={(e) => setChannelInapp(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-cyan-500"
                    />
                    <span>{t('In-App Dashboard', 'درون پنل کاربری')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={channelTelegram}
                      onChange={(e) => setChannelTelegram(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-cyan-500"
                    />
                    <span>{t('Telegram Bot', 'ربات تلگرام')}</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  {t('Cancel', 'انصراف')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                >
                  {t('Create Rule', 'ایجاد قانون هشدار')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

