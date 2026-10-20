import React, { useState, useEffect } from 'react';
import { Source, SourceGroup } from '../../types.ts';
import { apiRequest } from '../../utils/api.ts';
import { toRelativeTimeFa, toJalaliDate, toPersianDigits } from '../../utils/date.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import {
  Plus,
  RotateCw,
  Trash2,
  FileText,
  AlertCircle,
  Eye,
  Clock,
  X,
} from 'lucide-react';

export const SourcesView: React.FC = () => {
  const { t } = usePreferences();
  const [sources, setSources] = useState<Source[]>([]);
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPollLoading, setIsPollLoading] = useState<Record<string, boolean>>({});

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [dryRunData, setDryRunData] = useState<any | null>(null);

  // Form State for Add Source
  const [formType, setFormType] = useState<'account' | 'hashtag' | 'keyword' | 'query'>('account');
  const [formValue, setFormValue] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formIntervalNum, setFormIntervalNum] = useState<number>(30);
  const [formIntervalUnit, setFormIntervalUnit] = useState<'minutes' | 'hours'>('minutes');
  const [formProvider, setFormProvider] = useState<string>('');
  const [formGroupId, setFormGroupId] = useState<string>('');
  const [formExcludeRetweets, setFormExcludeRetweets] = useState(false);
  const [formExcludeReplies, setFormExcludeReplies] = useState(false);
  const [formLang, setFormLang] = useState('');
  const [formTimelineFallback, setFormTimelineFallback] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk Import text
  const [bulkText, setBulkText] = useState('');
  const [bulkType, setBulkType] = useState('account');
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [srcs, grps] = await Promise.all([
        apiRequest<Source[]>('/api/sources'),
        apiRequest<SourceGroup[]>('/api/sources/groups/all'),
      ]);
      setSources(srcs);
      setGroups(grps);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePollNow = async (source: Source) => {
    setIsPollLoading((prev) => ({ ...prev, [source.id]: true }));
    setStatusBanner(null);
    try {
      const res = await apiRequest<{ ok: boolean; newPostsCount: number; message: string }>(
        `/api/sources/${source.id}/poll-now`,
        { method: 'POST' }
      );
      setStatusBanner({
        ok: true,
        message: t(
          `Poll completed for ${source.display_name || source.value} (${res.newPostsCount} new posts).`,
          res.message
        ),
      });
      loadData();
    } catch (err: any) {
      setStatusBanner({ ok: false, message: `${t('Poll failed:', 'خطا در پایش:')} ${err.message}` });
    } finally {
      setIsPollLoading((prev) => ({ ...prev, [source.id]: false }));
    }
  };

  const handleDryRun = async (id: string) => {
    try {
      const data = await apiRequest(`/api/sources/${id}/dry-run`);
      setDryRunData(data);
    } catch (err: any) {
      setStatusBanner({ ok: false, message: `${t('Dry run error:', 'خطا در بررسی شبیه‌سازی:')} ${err.message}` });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setStatusBanner(null);
    try {
      await apiRequest(`/api/sources/${id}`, { method: 'DELETE' });
      setSources((prev) => prev.filter((s) => s.id !== id));
      setStatusBanner({
        ok: true,
        message: t(`Source "${name}" deleted successfully.`, `منبع «${name}» با موفقیت حذف گردید.`),
      });
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  const handleToggleEnable = async (source: Source) => {
    const newVal = source.enabled ? 0 : 1;
    try {
      await apiRequest(`/api/sources/${source.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: newVal }),
      });
      setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, enabled: newVal } : s)));
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const intervalMinutes = formIntervalUnit === 'hours' ? formIntervalNum * 60 : formIntervalNum;

    try {
      await apiRequest('/api/sources', {
        method: 'POST',
        body: JSON.stringify({
          type: formType,
          value: formValue,
          display_name: formDisplayName || undefined,
          interval_minutes: intervalMinutes,
          provider: formProvider || null,
          group_id: formGroupId || null,
          exclude_retweets: formExcludeRetweets ? 1 : 0,
          exclude_replies: formExcludeReplies ? 1 : 0,
          lang: formLang || undefined,
          use_timeline_fallback: formTimelineFallback ? 1 : 0,
        }),
      });

      setShowAddModal(false);
      setFormValue('');
      setFormDisplayName('');
      setStatusBanner({
        ok: true,
        message: t('New source added successfully.', 'منبع جدید با موفقیت اضافه شد.'),
      });
      loadData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    try {
      const res = await apiRequest<{ ok: boolean; count: number; message: string }>('/api/sources/bulk', {
        method: 'POST',
        body: JSON.stringify({
          text: bulkText,
          type: bulkType,
          group_id: formGroupId || undefined,
        }),
      });
      setStatusBanner({
        ok: true,
        message: t(`Bulk import completed (${res.count || ''} sources added).`, res.message),
      });
      setShowBulkModal(false);
      setBulkText('');
      loadData();
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  return (
    <div className="space-y-5">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{t('Monitored Sources', 'منابع پایش فعال')}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono font-bold">
              {toPersianDigits(sources.length)} {t('sources', 'منبع')}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t(
              'X accounts, hashtags, keywords, or advanced search queries with independent polling intervals',
              'حساب‌های توییتر، هشتگ‌ها، کلیدواژه‌ها یا پرس‌وجوهای پیچیده با زمان‌بندی مستقل'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('Bulk Import', 'افزودن دسته‌جمعی')}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('New Source', 'منبع جدید')}</span>
          </button>
        </div>
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
          <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-slate-100">
            {t('Dismiss', 'بستن')}
          </button>
        </div>
      )}

      {/* Sources Table / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm">
          {t('Loading monitored sources...', 'در حال بارگذاری منابع...')}
        </div>
      ) : sources.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 text-sm">
            {t('No sources added yet.', 'هنوز منبعی اضافه نکرده‌اید.')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {sources.map((s) => (
            <div
              key={s.id}
              className={`rounded-2xl border p-4 sm:p-5 transition-all bg-slate-900/60 ${
                s.enabled ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: `${s.color || '#38bdf8'}20`, color: s.color || '#38bdf8' }}
                  >
                    {s.type === 'account' ? '@' : s.type === 'hashtag' ? '#' : '𝕏'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-100 text-sm">{s.display_name || s.value}</span>
                      <span className="text-xs text-slate-400 font-mono" dir="ltr">
                        {s.type === 'account' ? `@${s.value}` : s.value}
                      </span>
                      {s.group_name && (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor: `${s.group_color || '#06b6d4'}40`,
                            color: s.group_color || '#06b6d4',
                            backgroundColor: `${s.group_color || '#06b6d4'}15`,
                          }}
                        >
                          {s.group_name}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {t('Priority:', 'اولویت:')} {toPersianDigits(s.priority || 3)}
                      </span>
                    </div>

                    {/* Stats & Scheduling Badges */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {t(
                            `Interval: Every ${s.effective_interval_minutes}m`,
                            `تناوب: هر ${toPersianDigits(s.effective_interval_minutes)} دقیقه`
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          (
                          {s.effective_interval_level === 'source'
                            ? t('Custom', 'اختصاصی')
                            : s.effective_interval_level === 'group'
                            ? t('Group', 'از گروه')
                            : t('Default', 'پیش‌فرض')}
                          )
                        </span>
                      </span>

                      <span>•</span>
                      <span>
                        {t('Provider:', 'ارائه‌دهنده:')}{' '}
                        {s.provider || t('twscrape (default)', 'twscrape (پیش‌فرض)')}
                      </span>

                      <span>•</span>
                      <span>
                        {t('Today:', 'پست امروز:')} {toPersianDigits(s.posts_today || 0)}
                      </span>

                      <span>•</span>
                      <span title={s.last_polled_at ? toJalaliDate(s.last_polled_at) : t('Never polled', 'تاکنون انجام نشده')}>
                        {t('Last Poll:', 'آخرین پایش:')}{' '}
                        {s.last_polled_at ? toRelativeTimeFa(s.last_polled_at) : t('Never', 'هنوز انجام نشده')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePollNow(s)}
                    disabled={isPollLoading[s.id]}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title={t('Poll this source immediately', 'اجرای دستی پایش منبع')}
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isPollLoading[s.id] ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{t('Poll Now', 'پایش فوری')}</span>
                  </button>

                  <button
                    onClick={() => handleDryRun(s.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-cyan-400 text-xs font-medium border border-slate-800 flex items-center gap-1 transition-colors"
                    title={t('Simulate & estimate monthly API cost', 'شبیه‌سازی و تخمین هزینه')}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Dry Run</span>
                  </button>

                  <button
                    onClick={() => handleToggleEnable(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      s.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {s.enabled ? t('Enabled', 'فعال') : t('Disabled', 'غیرفعال')}
                  </button>

                  <button
                    onClick={() => handleDelete(s.id, s.display_name || s.value)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                    title={t('Delete source', 'حذف منبع')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Error Alert if any */}
              {s.last_error && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-rose-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold">{t('Last Poll Error: ', 'خطا در آخرین پایش: ')}</span>
                    <span>{s.last_error}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {t('Add Monitored Source', 'افزودن منبع پایش جدید')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {/* Type */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {t('Source Type:', 'نوع منبع:')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['account', 'hashtag', 'keyword', 'query'] as const).map((typeKey) => (
                    <button
                      type="button"
                      key={typeKey}
                      onClick={() => setFormType(typeKey)}
                      className={`py-2 rounded-xl border text-center font-medium transition-colors ${
                        formType === typeKey
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {typeKey === 'account'
                        ? t('Account', 'حساب کاربر')
                        : typeKey === 'hashtag'
                        ? t('Hashtag', 'هشتگ')
                        : typeKey === 'keyword'
                        ? t('Keyword', 'کلیدواژه')
                        : t('X Query', 'کوئری X')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {formType === 'account'
                    ? t('Username (without @):', 'نام کاربری (بدون @):')
                    : formType === 'hashtag'
                    ? t('Hashtag (without #):', 'عنوان هشتگ (بدون #):')
                    : t('Keyword or Search Query:', 'عبارت یا کوئری پایش:')}
                </label>
                <input
                  type="text"
                  required
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={
                    formType === 'account'
                      ? 'elonmusk'
                      : formType === 'hashtag'
                      ? t('AI', 'هوش_مصنوعی')
                      : t('openai', 'استارتاپ')
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {t('Display Name (Optional):', 'نام نمایشی (اختیاری):')}
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder={t('e.g. Elon Musk', 'مثال: ایلان ماسک')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Interval & Unit */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {t('Polling Interval:', 'تناوب پایش:')}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min="1"
                    value={formIntervalNum}
                    onChange={(e) => setFormIntervalNum(Number(e.target.value))}
                    className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <select
                    value={formIntervalUnit}
                    onChange={(e) => setFormIntervalUnit(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="minutes">{t('Minutes', 'دقیقه')}</option>
                    <option value="hours">{t('Hours', 'ساعت')}</option>
                  </select>

                  {/* Presets */}
                  <div className="flex items-center gap-1 ms-2 flex-wrap">
                    {[15, 30, 60, 180, 360].map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => {
                          setFormIntervalNum(m >= 60 ? m / 60 : m);
                          setFormIntervalUnit(m >= 60 ? 'hours' : 'minutes');
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px]"
                      >
                        {m >= 60 ? `${m / 60}h` : `${m}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Group */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {t('Group / Category:', 'گروه / دسته‌بندی:')}
                </label>
                <select
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">{t('No Group (Default)', 'بدون گروه (پیش‌فرض)')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Override */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {t('Data Provider (Optional — inherits system default):', 'ارائه‌دهنده داده (اختیاری — پیش‌فرض سامانه اعمال می‌شود):')}
                </label>
                <select
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">{t('Use System Default', 'استفاده از پیش‌فرض سامانه')}</option>
                  <option value="twscrape">{t('twscrape (Sidecar - Free)', 'twscrape (سایدکار - رایگان)')}</option>
                  <option value="nitter-rss">{t('Nitter RSS (Public Feed - Free)', 'Nitter RSS (فید عمومی - رایگان)')}</option>
                  <option value="x-official">{t('Official X API v2 (Pay-per-use)', 'Official X API v2 (پرداخت بر اساس مصرف)')}</option>
                  <option value="twitterapi-io">{t('twitterapi.io (3rd-Party Paid)', 'twitterapi.io (سرویس شخص ثالث)')}</option>
                </select>
              </div>

              {/* Excludes */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formExcludeRetweets}
                    onChange={(e) => setFormExcludeRetweets(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500"
                  />
                  <span>{t('Exclude Retweets', 'حذف بازتوییت‌ها')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formExcludeReplies}
                    onChange={(e) => setFormExcludeReplies(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500"
                  />
                  <span>{t('Exclude Replies', 'حذف پاسخ‌ها')}</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {t('Cancel', 'انصراف')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {t('Add Source', 'افزودن منبع')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {t('Bulk Import Sources', 'افزودن دسته‌جمعی منابع')}
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-4 text-xs">
              <p className="text-slate-400">
                {t(
                  'Enter a list of accounts or hashtags (one per line). Prefix hashtags with # and accounts with @.',
                  'لیستی از حساب‌ها یا هشتگ‌ها را وارد کنید (هر کدام در یک خط). هشتگ‌ها با # یا حساب‌ها با @ می‌توانند مشخص شوند.'
                )}
              </p>
              <textarea
                rows={8}
                required
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'@sama\n@elonmusk\n#AI\n#Startups'}
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {t('Cancel', 'انصراف')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {t('Import Sources', 'ثبت منابع')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dry Run Result Modal */}
      {dryRunData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>{t('Cost & Call Simulation (Dry Run)', 'شبیه‌سازی و تخمین هزینه (Dry Run)')}</span>
              </h3>
              <button onClick={() => setDryRunData(null)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div>
                  <span className="text-slate-400">{t('Source: ', 'منبع: ')}</span>
                  <span className="text-cyan-400 font-bold">{dryRunData.source.value}</span>
                  <span className="text-slate-500"> ({dryRunData.source.type})</span>
                </div>
                <div>
                  <span className="text-slate-400">{t('Estimated Monthly Polls: ', 'تعداد پایش تخمینی در ماه: ')}</span>
                  <span className="font-mono text-slate-200">
                    {toPersianDigits(dryRunData.source.pollsPerMonth)} {t('polls', 'بار')}
                  </span>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Official X */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200">Official X API v2</div>
                  <div className="font-mono text-lg text-amber-400 font-bold">
                    ${dryRunData.officialX.estimatedMonthlyUsd}
                    <span className="text-[10px] text-slate-500 font-normal"> / {t('mo', 'ماه')}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono break-all bg-slate-900 p-2 rounded-lg" dir="ltr">
                    {dryRunData.officialX.endpoint}
                  </div>
                  <div className="text-[10px] text-slate-500">{dryRunData.officialX.auth}</div>
                </div>

                {/* twitterapi.io */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200">twitterapi.io</div>
                  <div className="font-mono text-lg text-emerald-400 font-bold">
                    ${dryRunData.twitterApiIo.estimatedMonthlyUsd}
                    <span className="text-[10px] text-slate-500 font-normal"> / {t('mo', 'ماه')}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono break-all bg-slate-900 p-2 rounded-lg" dir="ltr">
                    {dryRunData.twitterApiIo.endpoint}
                  </div>
                  <div className="text-[10px] text-slate-500">{dryRunData.twitterApiIo.auth}</div>
                </div>
              </div>

              {/* Free Providers Note */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 space-y-1">
                <div className="font-bold">{t('Free Providers (Default):', 'ارائه‌دهندگان رایگان (پیش‌فرض):')}</div>
                <div>
                  {t(
                    '• twscrape: $0/month (uses local scraper pool & syndication fallback)',
                    '• twscrape: هزینه صفر دلار (مصرف منابع سرور خودتان با کوکی حساب اختصاصی)'
                  )}
                </div>
                <div>
                  {t(
                    '• Nitter RSS: $0/month (fetches directly from public RSS mirrors)',
                    '• Nitter RSS: هزینه صفر دلار (دریافت مستقیم از فید عمومی)'
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDryRunData(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                {t('Close', 'بستن')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

