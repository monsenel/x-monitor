import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { toPersianDigits } from '../../utils/date.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { Bot, Plus, Trash2, Key, ShieldAlert, RefreshCw, X } from 'lucide-react';

interface ScraperAccount {
  username: string;
  active: boolean;
  last_error?: string;
  locks?: string[];
}

export const ScraperAccountsView: React.FC = () => {
  const { t, isRtl } = usePreferences();
  const [accounts, setAccounts] = useState<ScraperAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sidecarError, setSidecarError] = useState<string | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [ct0, setCt0] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setSidecarError(null);
    try {
      const data = await apiRequest<{ accounts: ScraperAccount[] }>('/api/scraper/accounts');
      setAccounts(data.accounts || []);
    } catch (err: any) {
      setSidecarError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setStatusBanner(null);

    try {
      await apiRequest('/api/scraper/accounts', {
        method: 'POST',
        body: JSON.stringify({
          username: username.replace(/^@/, ''),
          auth_token: authToken.trim(),
          ct0: ct0.trim(),
        }),
      });

      setShowAddModal(false);
      // Clear sensitive tokens immediately
      setUsername('');
      setAuthToken('');
      setCt0('');
      fetchAccounts();
      setStatusBanner({
        ok: true,
        message: t('Burner account registered in scraper successfully.', 'حساب اختصاصی با موفقیت در اسکرپر ثبت شد.'),
      });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (user: string) => {
    setStatusBanner(null);
    try {
      await apiRequest(`/api/scraper/accounts/${user}`, { method: 'DELETE' });
      setAccounts((prev) => prev.filter((a) => a.username !== user));
      setStatusBanner({
        ok: true,
        message: t(`Account @${user} removed successfully.`, `حساب @${user} با موفقیت حذف شد.`),
      });
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Permanent Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
          <div className="font-bold text-amber-400">
            {t('Important Security & Terms Notice:', 'هشدار بسیار مهم امنیتی و حقوقی:')}
          </div>
          <p>
            {t(
              'Use dedicated burner accounts ONLY — never add your primary personal X account! Automated scraping violates X Terms of Service and may result in temporary locks or suspension of the burner account.',
              'فقط و فقط از حساب‌های اختصاصی (Burner Accounts) استفاده کنید — هرگز حساب شخصی اصلی خود را اضافه نکنید! پایش و اسکرپ وب خلاف شرایط خدمات X (Terms of Service) است و ممکن است اکانت مورد استفاده قفل یا مسدود شود.'
            )}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span>{t('Scraper Accounts Pool (twscrape Sidecar)', 'مدیریت حساب‌های اسکرپر (twscrape Sidecar)')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'The internal sidecar automatically rotates across healthy burner accounts and respects rate-limit windows.',
              'سایدکار داخلی به صورت خودکار بین حساب‌های سالم گردش (Rotation) انجام می‌دهد و محدودیت‌های نرخ را رعایت می‌کند.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAccounts}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer"
            title={t('Refresh Status', 'به‌روزرسانی وضعیت')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('Add Burner Account', 'افزودن حساب جدید')}</span>
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
          <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white cursor-pointer">
            {t('Dismiss', 'بستن')}
          </button>
        </div>
      )}

      {/* Sidecar Connection Alert if error */}
      {sidecarError && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-xs text-rose-300">
          <span className="font-bold">
            {t('Scraper Sidecar Unavailable: ', 'عدم دسترسی به سایدکار اسکرپر: ')}
          </span>
          <span>{sidecarError}</span>
          <p className="mt-1 text-[11px] text-slate-400">
            {t(
              'The Python scraper container is not running or SIDECAR_URL is unreachable. Start it via ',
              'کانتینر پایتون scraper در حال اجرا نیست یا آدرس SIDECAR_URL صحیح نیست. برای راه‌اندازی کانتینر دستور '
            )}
            <code className="text-cyan-400">docker compose up -d scraper</code>
            {t('.', ' را اجرا کنید.')}
          </p>
        </div>
      )}

      {/* Accounts List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-200">
          {t('Registered Accounts', 'حساب‌های ثبت‌شده')} ({toPersianDigits(accounts.length)})
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {t('Checking scraper accounts...', 'در حال بررسی حساب‌ها...')}
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-10 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
            <p className="text-slate-300 text-sm font-medium">
              {t('No accounts registered in the scraper pool.', 'هیچ حسابی در اسکرپر ثبت نشده است.')}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {t(
                'To use the default free twscrape provider, add at least one burner X account using its auth_token and ct0 cookies.',
                'جهت استفاده از ارائه‌دهنده پیش‌فرض و رایگان twscrape، حداقل یک حساب اختصاصی با کوکی‌های auth_token و ct0 اضافه کنید.'
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {accounts.map((acc) => (
              <div
                key={acc.username}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200 font-mono">@{acc.username}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                        acc.active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {acc.active ? t('Active & Ready', 'فعال و آماده') : t('Locked / Inactive', 'قفل یا غیرفعال')}
                    </span>
                  </div>

                  {acc.locks && acc.locks.length > 0 && (
                    <div className="mt-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg">
                      {t('Temporary rate-limit locks:', 'دارای قفل موقت نرخ:')} {acc.locks.join(', ')}
                    </div>
                  )}

                  {acc.last_error && (
                    <div className="mt-2 text-xs text-rose-300 bg-rose-500/10 p-2 rounded-lg">
                      {t('Last error:', 'آخرین خطا:')} {acc.last_error}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
                  <button
                    onClick={() => handleDeleteAccount(acc.username)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('Remove Account', 'حذف حساب')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guide Box */}
      <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl space-y-2 text-xs text-slate-400 leading-relaxed">
        <h4 className="font-bold text-slate-200 text-sm">
          {t('How to extract auth_token and ct0 cookies?', 'چگونه کوکی‌های auth_token و ct0 را استخراج کنیم؟')}
        </h4>
        <ol className={`list-decimal list-inside space-y-1 ${isRtl ? 'pr-1' : 'pl-1'} text-slate-300`}>
          <li>
            {t(
              'Sign into your dedicated burner X account in a desktop browser (Chrome or Firefox).',
              'در یک مرورگر (مانند کروم یا فایرفاکس)، وارد حساب اختصاصی توییتر (X) خود شوید.'
            )}
          </li>
          <li>
            {t(
              'Press F12 to open Developer Tools (DevTools).',
              'کلید F12 را فشار دهید تا ابزارهای توسعه‌دهنده (DevTools) باز شود.'
            )}
          </li>
          <li>
            {t(
              'Navigate to the Application tab (or Storage in Firefox).',
              'به سربرگ Application (یا در فایرفاکس Storage) بروید.'
            )}
          </li>
          <li>
            {t(
              'Expand Cookies on the sidebar and select https://x.com.',
              'در ستون چپ، بخش Cookies را باز کرده و دامنه https://x.com را انتخاب کنید.'
            )}
          </li>
          <li>
            {t(
              'Copy the values for auth_token and ct0 and paste them into the registration modal.',
              'مقادیر دو کوکی به نام‌های auth_token و ct0 را کپی کرده و در فرم زیر جای‌گذاری نمایید.'
            )}
          </li>
        </ol>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>{t('Add Burner Scraper Account', 'افزودن حساب اختصاصی اسکرپر')}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('X Username (without @):', 'نام کاربری X (بدون @):')}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="burner_bot_1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('auth_token Cookie:', 'کوکی auth_token:')}
                </label>
                <input
                  type="password"
                  required
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder={t('Paste auth_token cookie value', 'مقدار کوکی auth_token را پیست کنید')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('ct0 Cookie (CSRF Token):', 'کوکی ct0 (CSRF Token):')}
                </label>
                <input
                  type="password"
                  required
                  value={ct0}
                  onChange={(e) => setCt0(e.target.value)}
                  placeholder={t('Paste ct0 cookie value', 'مقدار کوکی ct0 را پیست کنید')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                {t(
                  'Cookies are forwarded directly to the internal sidecar and are not stored in the main app database.',
                  'کوکی‌ها مستقیماً به سایدکار داخلی ارسال می‌شوند و در دیتابیس برنامه ذخیره نخواهند شد.'
                )}
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t('Registering...', 'در حال ثبت...') : t('Register Account', 'ثبت در اسکرپر')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

