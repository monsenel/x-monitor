import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { ProviderInfo } from '../../types.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { NitterLocalPanel } from './NitterLocalPanel.tsx';
import {
  Settings,
  DollarSign,
  Sparkles,
  Database,
  Download,
  Trash2,
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  Cpu,
  Globe,
  Eye,
  EyeOff,
  ExternalLink,
  Sun,
  Moon,
  Languages,
  Send,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t, lang, setLang, theme, setTheme, isRtl } = usePreferences();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; testing?: boolean }>>({});
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [s, p] = await Promise.all([
        apiRequest<Record<string, string>>('/api/settings'),
        apiRequest<ProviderInfo[]>('/api/providers'),
      ]);
      setSettings(s);
      setProviders(p);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusBanner(null);
    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setStatusBanner({
        ok: true,
        message: t('Settings saved successfully.', 'تنظیمات با موفقیت ذخیره شد.'),
      });
      loadData();
    } catch (err: any) {
      setStatusBanner({
        ok: false,
        message: t(`Failed to save settings: ${err.message}`, `خطا در ذخیره تنظیمات: ${err.message}`),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestResults((prev) => ({
      ...prev,
      [providerId]: {
        ok: false,
        message: t('Testing connection...', 'در حال بررسی اتصال...'),
        testing: true,
      },
    }));
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>(`/api/providers/${providerId}/test`, {
        method: 'POST',
      });
      setTestResults((prev) => ({ ...prev, [providerId]: { ok: res.ok, message: res.message, testing: false } }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [providerId]: { ok: false, message: err.message, testing: false } }));
    }
  };

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const provider = settings['ai_provider'] || 'gemini';
      const body: any = { provider };
      if (provider === 'gemini') {
        body.model = settings['ai_model'] || 'gemini-3.8-flash';
        body.apiKey = settings['ai_gemini_api_key'];
      } else if (provider === 'openai') {
        body.baseUrl = settings['ai_openai_base_url'] || 'https://api.openai.com/v1';
        body.apiKey = settings['ai_openai_api_key'];
        body.model = settings['ai_openai_model'] || 'gpt-4o-mini';
      } else if (provider === 'openrouter') {
        body.apiKey = settings['ai_openrouter_api_key'];
        body.model = settings['ai_openrouter_model'] || 'openai/gpt-4o-mini';
      }

      const res = await apiRequest<{ ok: boolean; message: string }>('/api/settings/test-ai', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({
        ok: false,
        message: err.message || t('AI connection test failed', 'خطا در آزمون اتصال هوش مصنوعی'),
      });
    } finally {
      setAiTesting(false);
    }
  };

  const handleTestTelegram = async () => {
    setTgTesting(true);
    setTgTestResult(null);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/settings/test-telegram', {
        method: 'POST',
        body: JSON.stringify({
          token: settings['telegram_bot_token'] || '',
          chatIds: settings['telegram_chat_ids'] || '',
        }),
      });
      setTgTestResult(res);
    } catch (err: any) {
      setTgTestResult({ ok: false, message: err.message });
    } finally {
      setTgTesting(false);
    }
  };

  const handleRetentionCleanup = async () => {
    setStatusBanner(null);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/settings/retention-cleanup', {
        method: 'POST',
      });
      setStatusBanner({ ok: true, message: res.message });
    } catch (err: any) {
      setStatusBanner({ ok: false, message: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        {t('Loading system settings...', 'در حال بارگذاری تنظیمات...')}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <span>
              {t('System Settings, Providers & Cost Control', 'تنظیمات سامانه، ارائه‌دهندگان و کنترل هزینه')}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'Configure default data provider, unit pricing, monthly budget caps, appearance, and AI keys',
              'پیکربندی ارائه‌دهنده پیش‌فرض، نرخ‌ها، سقف بودجه ماهانه و کلید هوش مصنوعی'
            )}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? t('Saving...', 'در حال ذخیره‌سازی...') : t('Save Changes', 'ذخیره تغییرات')}</span>
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
          <div className="flex items-center gap-2">
            {statusBanner.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{statusBanner.message}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer"
          >
            {t('Dismiss', 'بستن')}
          </button>
        </div>
      )}

      {/* 0. Language & Theme Quick Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Languages className="w-4 h-4 text-cyan-400" />
          <span>{t('Interface Language & Appearance', 'زبان رابط کاربری و ظاهر سامانه')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-2">
              {t('Panel Language:', 'زبان پنل کاربری:')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLang('en');
                  handleChange('language', 'en');
                }}
                className={`py-2.5 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                English (Default)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLang('fa');
                  handleChange('language', 'fa');
                }}
                className={`py-2.5 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                  lang === 'fa'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                فارسی (راست‌چین)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-2">
              {t('Color Theme:', 'پوسته رنگی (تم):')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  handleChange('theme', 'dark');
                }}
                className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t('Dark Mode', 'حالت تیره (Dark)')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  handleChange('theme', 'light');
                }}
                className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t('Light Mode', 'حالت روشن (Light)')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Providers & Connections */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>{t('Data Providers & Connection Tests', 'ارائه‌دهندگان داده و آزمون اتصال')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1.5">
              {t('Default Data Provider:', 'ارائه‌دهنده پیش‌فرض سامانه:')}
            </label>
            <select
              value={settings['default_provider'] || 'twscrape'}
              onChange={(e) => handleChange('default_provider', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="twscrape">
                {t('twscrape (Local Sidecar - Free & Default)', 'twscrape (سایدکار محلی - رایگان و پیش‌فرض)')}
              </option>
              <option value="nitter-rss">
                {t('Nitter RSS (Public Feed - Free)', 'Nitter RSS (فید عمومی - رایگان)')}
              </option>
              <option value="x-official">
                {t('Official X API v2 (Paid)', 'Official X API v2 (API رسمی - پولی)')}
              </option>
              <option value="twitterapi-io">
                {t('twitterapi.io (3rd-Party Paid)', 'twitterapi.io (سرویس شخص ثالث - پولی)')}
              </option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={settings['auto_nitter_fallback'] !== '0'}
                onChange={(e) => handleChange('auto_nitter_fallback', e.target.checked ? '1' : '0')}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500"
              />
              <span>
                {t(
                  'Automatically fall back to Nitter RSS after 3 consecutive failures',
                  'تغییر خودکار به Nitter RSS در صورت ۳ شکست متوالی ارائه‌دهنده اصلی'
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Providers Connection Test Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {providers.map((p) => {
            const test = testResults[p.id];
            return (
              <div key={p.id} className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-200">{p.name}</span>
                    <span className="text-[10px] text-slate-500 block">
                      {p.isFree ? t('Free', 'رایگان') : t('Paid Credits', 'نیازمند شارژ مالی')} •{' '}
                      {p.configured ? t('Configured', 'پیکربندی‌شده') : t('Key Not Set', 'کلید تعریف‌نشده')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTestProvider(p.id)}
                    disabled={test?.testing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${test?.testing ? 'animate-spin' : ''}`} />
                    <span>{t('Test Connection', 'تست اتصال')}</span>
                  </button>
                </div>

                {test && (
                  <div
                    className={`text-[11px] p-2 rounded-lg flex items-start gap-1.5 ${
                      test.ok
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {test.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 mt-0.5" />}
                    <span>{test.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Cost Control & Unit Prices */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>{t('Monthly Budgets & Unit Pricing (Cost Control)', 'بودجه ماهانه و نرخ‌های واحد ارائه‌دهندگان (Cost Control)')}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('Total Monthly Budget Cap ($):', 'سقف بودجه ماهانه کل ($):')}
            </label>
            <input
              type="number"
              step="0.5"
              value={settings['budget_total_monthly'] || '15'}
              onChange={(e) => handleChange('budget_total_monthly', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('Official X Monthly Cap ($):', 'سقف بودجه Official X ($):')}
            </label>
            <input
              type="number"
              step="0.5"
              value={settings['budget_x_official_monthly'] || '10'}
              onChange={(e) => handleChange('budget_x_official_monthly', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('twitterapi.io Monthly Cap ($):', 'سقف بودجه twitterapi.io ($):')}
            </label>
            <input
              type="number"
              step="0.5"
              value={settings['budget_twitterapi_io_monthly'] || '5'}
              onChange={(e) => handleChange('budget_twitterapi_io_monthly', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-xs font-bold text-slate-300 mb-2">
            {t('Unit Cost Rates (Editable):', 'نرخ‌های محاسباتی هر واحد (قابل ویرایش):')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">
                {t('X Official per Tweet Read ($):', 'نرخ هر توییت X Official ($):')}
              </span>
              <input
                type="number"
                step="0.001"
                value={settings['price_x_official_tweet_read'] || '0.005'}
                onChange={(e) => handleChange('price_x_official_tweet_read', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">
                {t('twitterapi.io per Tweet ($):', 'نرخ هر توییت twitterapi.io ($):')}
              </span>
              <input
                type="number"
                step="0.00001"
                value={settings['price_twitterapi_io_tweet_read'] || '0.00015'}
                onChange={(e) => handleChange('price_twitterapi_io_tweet_read', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">
                {t('twitterapi.io per User Profile ($):', 'نرخ پروفایل کاربر twitterapi.io ($):')}
              </span>
              <input
                type="number"
                step="0.00001"
                value={settings['price_twitterapi_io_user_read'] || '0.00018'}
                onChange={(e) => handleChange('price_twitterapi_io_user_read', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Local Nitter */}
      <NitterLocalPanel />

      {/* 4. AI & Digest Schedule */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>
              {t(
                'AI Configuration (Google Gemini / OpenAI Compatible / OpenRouter)',
                'پیکربندی هوش مصنوعی (Google Gemini / OpenAI Compatible / OpenRouter)'
              )}
            </span>
          </h3>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={settings['ai_enrichment_enabled'] !== '0'}
                onChange={(e) => handleChange('ai_enrichment_enabled', e.target.checked ? '1' : '0')}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500"
              />
              <span>{t('Enable Smart AI Enrichment & Translation', 'فعال‌سازی ارزیابی هوشمند و ترجمه خودکار')}</span>
            </label>
          </div>
        </div>

        {/* AI Provider Selector */}
        <div>
          <label className="block text-xs text-slate-300 font-medium mb-2">
            {t('AI Service Provider:', 'ارائه‌دهنده سرویس هوش مصنوعی:')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'gemini',
                title: 'Google Gemini',
                subtitle: t('Default SDK (Flash / Pro)', 'پیش‌فرض (Flash / Pro)'),
                icon: Sparkles,
                color: 'text-cyan-400',
                border: 'border-cyan-500/40 bg-cyan-500/5',
              },
              {
                id: 'openai',
                title: 'OpenAI Compatible',
                subtitle: 'OpenAI, Groq, DeepSeek, Ollama, LocalAI',
                icon: Cpu,
                color: 'text-emerald-400',
                border: 'border-emerald-500/40 bg-emerald-500/5',
              },
              {
                id: 'openrouter',
                title: 'OpenRouter',
                subtitle: t('Unified access to Claude, Llama, DeepSeek', 'دسترسی یکپارچه به Claude، Llama، DeepSeek'),
                icon: Globe,
                color: 'text-purple-400',
                border: 'border-purple-500/40 bg-purple-500/5',
              },
            ].map((prov) => {
              const active = (settings['ai_provider'] || 'gemini') === prov.id;
              const Icon = prov.icon;
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => handleChange('ai_provider', prov.id)}
                  className={`p-3.5 rounded-xl border ${isRtl ? 'text-right' : 'text-left'} transition-all flex flex-col justify-between cursor-pointer ${
                    active
                      ? `${prov.border} ring-1 ring-cyan-500 shadow-lg`
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 ${prov.color}`} />
                      <span>{prov.title}</span>
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        active ? 'border-cyan-400 bg-cyan-400' : 'border-slate-700'
                      }`}
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-snug">{prov.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Provider Settings */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 space-y-4">
          {/* 1. Google Gemini Config */}
          {(!settings['ai_provider'] || settings['ai_provider'] === 'gemini') && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('Google Gemini Settings', 'تنظیمات Google Gemini')}</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {t('Official Gemini SDK with structured JSON Schema', 'سرویس رسمی Gemini SDK با فرمت ساختاریافته')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('Gemini Model:', 'مدل Gemini:')}</label>
                  <select
                    value={settings['ai_model'] || 'gemini-3.8-flash'}
                    onChange={(e) => handleChange('ai_model', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  >
                    <option value="gemini-3.8-flash">
                      {t('gemini-3.8-flash (Latest - Fast & Optimal)', 'gemini-3.8-flash (جدیدترین نسخه - سریع و بهینه)')}
                    </option>
                    <option value="gemini-3.1-flash-lite">
                      {t('gemini-3.1-flash-lite (Ultra Fast & Economical)', 'gemini-3.1-flash-lite (نسخه فوق سریع و اقتصادی)')}
                    </option>
                    <option value="gemini-flash-latest">
                      {t('gemini-flash-latest (Stable Flash)', 'gemini-flash-latest (آخرین نسخه پایدار Flash)')}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    {t('Custom Gemini API Key (Optional):', 'کلید اختصاصی Gemini API (اختیاری):')}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings['ai_gemini_api_key'] || ''}
                      onChange={(e) => handleChange('ai_gemini_api_key', e.target.value)}
                      placeholder={t(
                        'Uses environment GEMINI_API_KEY if left blank',
                        'در صورت خالی بودن از کلید محیط GEMINI_API_KEY استفاده می‌شود'
                      )}
                      className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] ${
                        isRtl ? 'pl-9' : 'pr-9'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer`}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. OpenAI Compatible Config */}
          {settings['ai_provider'] === 'openai' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{t('OpenAI Compatible Provider Settings', 'تنظیمات ارائه‌دهنده سازگار با OpenAI')}</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {t('Supports any REST /chat/completions server', 'پشتیبانی از هر سرور با استاندارد REST /chat/completions')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    {t('Server Base URL:', 'آدرس پایه سرور (Base URL):')}
                  </label>
                  <input
                    type="text"
                    value={settings['ai_openai_base_url'] || 'https://api.openai.com/v1'}
                    onChange={(e) => handleChange('ai_openai_base_url', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">{t('Presets:', 'پیش‌فرض‌ها:')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'https://api.openai.com/v1');
                        handleChange('ai_openai_model', 'gpt-4o-mini');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono cursor-pointer"
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'https://api.groq.com/openai/v1');
                        handleChange('ai_openai_model', 'llama-3.3-70b-versatile');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono cursor-pointer"
                    >
                      Groq
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'https://api.deepseek.com/v1');
                        handleChange('ai_openai_model', 'deepseek-chat');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono cursor-pointer"
                    >
                      DeepSeek
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'http://localhost:11434/v1');
                        handleChange('ai_openai_model', 'llama3');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono cursor-pointer"
                    >
                      {t('Ollama (Local)', 'Ollama (محلی)')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{t('Model Name:', 'نام مدل (Model Name):')}</label>
                  <input
                    type="text"
                    value={settings['ai_openai_model'] || 'gpt-4o-mini'}
                    onChange={(e) => handleChange('ai_openai_model', e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">{t('Models:', 'مدل‌ها:')}</span>
                    {['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'llama-3.3-70b-versatile'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleChange('ai_openai_model', m)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-mono cursor-pointer"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('API Key (Bearer Token):', 'کلید API (Bearer Token):')}</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings['ai_openai_api_key'] || ''}
                    onChange={(e) => handleChange('ai_openai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] ${
                      isRtl ? 'pl-9' : 'pr-9'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer`}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. OpenRouter Config */}
          {settings['ai_provider'] === 'openrouter' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-400">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{t('OpenRouter Service Settings', 'تنظیمات سرویس OpenRouter')}</span>
                </span>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-purple-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>{t('Get API Key from openrouter.ai', 'دریافت کلید از openrouter.ai')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    {t('OpenRouter API Key:', 'کلید OpenRouter API Key:')}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings['ai_openrouter_api_key'] || ''}
                      onChange={(e) => handleChange('ai_openrouter_api_key', e.target.value)}
                      placeholder="sk-or-v1-..."
                      className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] ${
                        isRtl ? 'pl-9' : 'pr-9'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer`}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{t('Model ID:', 'شناسه مدل (Model ID):')}</label>
                  <input
                    type="text"
                    value={settings['ai_openrouter_model'] || 'openai/gpt-4o-mini'}
                    onChange={(e) => handleChange('ai_openrouter_model', e.target.value)}
                    placeholder="anthropic/claude-3.5-sonnet"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">{t('Popular:', 'محبوب‌ترین‌ها:')}</span>
                    {[
                      'openai/gpt-4o-mini',
                      'anthropic/claude-3.5-sonnet',
                      'deepseek/deepseek-chat',
                      'meta-llama/llama-3.3-70b-instruct',
                    ].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleChange('ai_openrouter_model', m)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-purple-300 font-mono cursor-pointer"
                      >
                        {m.split('/')[1]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Connection Action Bar */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400">
              {t(
                'Test connectivity and response of your selected AI model before saving:',
                'می‌توانید پیش از ذخیره، عملکرد و صحت اتصال مدل انتخابی را تست کنید:'
              )}
            </div>
            <button
              type="button"
              onClick={handleTestAi}
              disabled={aiTesting}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-cyan-500/20 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiTesting ? 'animate-spin' : ''}`} />
              <span>
                {aiTesting ? t('Testing AI Connection...', 'در حال آزمون ارتباط...') : t('Test AI Connection', 'تست اتصال هوش مصنوعی')}
              </span>
            </button>
          </div>

          {/* Test Result Message Banner */}
          {aiTestResult && (
            <div
              className={`text-xs p-3 rounded-xl flex items-start gap-2 ${
                aiTestResult.ok
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              {aiTestResult.ok ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span className="leading-relaxed">{aiTestResult.message}</span>
            </div>
          )}
        </div>

        {/* Batch & Digest Schedule Controls */}
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('Enrichment Batch Size:', 'اندازه بسته ارزیابی (Batch Size):')}
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings['ai_batch_size'] || '5'}
              onChange={(e) => handleChange('ai_batch_size', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('Digest Generation Schedule:', 'زمان‌بندی تولید دایجست:')}
            </label>
            <select
              value={settings['digest_schedule_type'] || 'daily'}
              onChange={(e) => handleChange('digest_schedule_type', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              <option value="daily">{t('Daily (At specified time)', 'روزانه (یک بار در ساعت مشخص)')}</option>
              <option value="hourly">{t('Hourly', 'ساعتی')}</option>
              <option value="off">{t('Disabled (Manual only)', 'غیرفعال (فقط دستی)')}</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('Daily Digest Time:', 'ساعت ارسال دایجست روزانه:')}
            </label>
            <input
              type="time"
              value={settings['digest_daily_time'] || '20:00'}
              onChange={(e) => handleChange('digest_daily_time', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer md:col-span-2">
            <input
              type="checkbox"
              checked={settings['digest_skip_repeated'] !== '0'}
              onChange={(e) => handleChange('digest_skip_repeated', e.target.checked ? '1' : '0')}
            />
            <span>{t('Skip news already covered in earlier digests', 'عدم تکرار خبرهایی که قبلاً در خلاصه‌های پیشین آمده')}</span>
          </label>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {t('Digest / clustering look-back (hours):', 'بازه بررسی دایجست و خوشه‌بندی (ساعت):')}
            </label>
            <input
              type="number"
              min={1}
              value={settings['digest_window_hours'] || '24'}
              onChange={(e) => handleChange('digest_window_hours', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
            />
            <p className="text-slate-500 mt-1">
              {t('Posts older than this (by post time) are ignored. Use 72 or 168 for accounts that post rarely.', 'پست‌های قدیمی‌تر از این (بر اساس زمان پست) نادیده گرفته می‌شوند. برای حساب‌هایی که کم پست می‌گذارند ۷۲ یا ۱۶۸ بگذارید.')}
            </p>
          </div>
        </div>
      </div>

      {/* Telegram Notifications */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Send className="w-4 h-4 text-cyan-400" />
          <span>{t('Telegram Notifications', 'اعلان‌های تلگرام')}</span>
        </h3>

        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings['telegram_enabled'] !== '0'}
                onChange={(e) => handleChange('telegram_enabled', e.target.checked ? '1' : '0')}
              />
              <span>{t('Enable Telegram sending', 'فعال بودن ارسال به تلگرام')}</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings['telegram_send_digests'] !== '0'}
                onChange={(e) => handleChange('telegram_send_digests', e.target.checked ? '1' : '0')}
              />
              <span>{t('Send digests automatically', 'ارسال خودکار خلاصه‌ها (Digest)')}</span>
            </label>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              {t('Bot token (from @BotFather):', 'توکن ربات (از @BotFather):')}
            </label>
            <div className="relative">
              <input
                type={showTgToken ? 'text' : 'password'}
                dir="ltr"
                value={settings['telegram_bot_token'] || ''}
                onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                placeholder="123456789:AAH..."
                className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] ${
                  isRtl ? 'pl-9' : 'pr-9'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowTgToken(!showTgToken)}
                className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer`}
              >
                {showTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              {t('Recipient chat IDs (one per line or comma-separated):', 'شناسه گیرنده‌ها (هر خط یکی، یا با کاما جدا کنید):')}
            </label>
            <textarea
              dir="ltr"
              rows={3}
              value={settings['telegram_chat_ids'] || ''}
              onChange={(e) => handleChange('telegram_chat_ids', e.target.value)}
              placeholder={'123456789\n-1001234567890\n@my_channel'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
            />
            <p className="text-slate-500 mt-1 leading-relaxed">
              {t(
                'Send /id to your bot in Telegram and it replies with your numeric ID (add the bot to a group and send /id there for the group ID). Usernames of people do not work, only numeric IDs, or @channel (bot must be admin).',
                'در تلگرام به ربات خود /id بفرستید تا شناسه عددی شما را بگوید (برای گروه، ربات را عضو کنید و همان‌جا /id بفرستید). نام کاربری افراد کار نمی‌کند؛ فقط شناسه عددی یا @کانال (ربات باید ادمین باشد).'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTestTelegram}
              disabled={tgTesting}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{tgTesting ? t('Sending...', 'در حال ارسال...') : t('Send test message', 'ارسال پیام آزمایشی')}</span>
            </button>
            <span className="text-slate-500">{t('Uses the values above, even before saving.', 'با مقادیر بالا، حتی قبل از ذخیره، آزمایش می‌شود.')}</span>
          </div>

          {tgTestResult && (
            <div
              className={`p-3 rounded-xl border whitespace-pre-line ${
                tgTestResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {tgTestResult.message}
            </div>
          )}
        </div>
      </div>

      {/* 5. Data Retention & Backup */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="w-4 h-4 text-cyan-400" />
          <span>{t('Data Retention & Database Backup', 'نگه‌داری داده‌ها و پشتیبان‌گیری دیتابیس')}</span>
        </h3>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">{t('Retain posts for (days):', 'نگه‌داری پست‌ها تا (روز):')}</span>
            <input
              type="number"
              value={settings['retention_days'] || '30'}
              onChange={(e) => handleChange('retention_days', e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
            />
            <button
              onClick={handleRetentionCleanup}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('Clean Up Now', 'پاکسازی دستی اکنون')}</span>
            </button>
          </div>

          <a
            href="/api/settings/backup"
            download
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center gap-2 font-medium"
          >
            <Download className="w-4 h-4" />
            <span>{t('Download SQLite Backup', 'دانلود فایل پشتیبان SQLite')}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

