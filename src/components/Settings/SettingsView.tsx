import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { ProviderInfo } from '../../types.ts';
import {
  Settings,
  ShieldCheck,
  DollarSign,
  Sparkles,
  Database,
  Download,
  Trash2,
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Layers,
  Cpu,
  Key,
  Globe,
  Server,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; testing?: boolean }>>({});
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

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
    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      alert('تنظیمات با موفقیت ذخیره شد.');
      loadData();
    } catch (err: any) {
      alert(`خطا در ذخیره تنظیمات: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestResults((prev) => ({ ...prev, [providerId]: { ok: false, message: 'در حال بررسی اتصال...', testing: true } }));
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
        body.model = settings['ai_model'] || 'gemini-2.5-flash';
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
      setAiTestResult({ ok: false, message: err.message || 'خطا در آزمون اتصال هوش مصنوعی' });
    } finally {
      setAiTesting(false);
    }
  };

  const handleRetentionCleanup = async () => {
    if (!confirm('آیا از اجرای پاکسازی پست‌های قدیمی (به جز نشان‌شده‌ها) اطمینان دارید؟')) return;
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/settings/retention-cleanup', {
        method: 'POST',
      });
      alert(res.message);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 text-xs">در حال بارگذاری تنظیمات...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <span>تنظیمات سامانه، ارائه‌دهندگان و کنترل هزینه</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            پیکربندی ارائه‌دهنده پیش‌فرض، نرخ‌ها، سقف بودجه ماهانه و کلید هوش مصنوعی
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات'}</span>
        </button>
      </div>

      {/* 1. Providers & Connections */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>ارائه‌دهندگان داده و آزمون اتصال</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1.5">ارائه‌دهنده پیش‌فرض سامانه:</label>
            <select
              value={settings['default_provider'] || 'twscrape'}
              onChange={(e) => handleChange('default_provider', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="twscrape">twscrape (سایدکار محلی - رایگان و پیش‌فرض)</option>
              <option value="nitter-rss">Nitter RSS (فید عمومی - رایگان)</option>
              <option value="x-official">Official X API v2 (API رسمی - پولی)</option>
              <option value="twitterapi-io">twitterapi.io (سرویس شخص ثالث - پولی)</option>
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
              <span>تغییر خودکار به Nitter RSS در صورت ۳ شکست متوالی ارائه‌دهنده اصلی</span>
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
                      {p.isFree ? 'رایگان' : 'نیازمند شارژ مالی'} • {p.configured ? 'پیکربندی‌شده' : 'کلید تعریف‌نشده'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTestProvider(p.id)}
                    disabled={test?.testing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${test?.testing ? 'animate-spin' : ''}`} />
                    <span>تست اتصال</span>
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
          <span>بودجه ماهانه و نرخ‌های واحد ارائه‌دهندگان (Cost Control)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">سقف بودجه ماهانه کل ($):</label>
            <input
              type="number"
              step="0.5"
              value={settings['budget_total_monthly'] || '15'}
              onChange={(e) => handleChange('budget_total_monthly', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">سقف بودجه Official X ($):</label>
            <input
              type="number"
              step="0.5"
              value={settings['budget_x_official_monthly'] || '10'}
              onChange={(e) => handleChange('budget_x_official_monthly', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">سقف بودجه twitterapi.io ($):</label>
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
          <div className="text-xs font-bold text-slate-300 mb-2">نرخ‌های محاسباتی هر واحد (قابل ویرایش):</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">نرخ هر توییت X Official ($):</span>
              <input
                type="number"
                step="0.001"
                value={settings['price_x_official_tweet_read'] || '0.005'}
                onChange={(e) => handleChange('price_x_official_tweet_read', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">نرخ هر توییت twitterapi.io ($):</span>
              <input
                type="number"
                step="0.00001"
                value={settings['price_twitterapi_io_tweet_read'] || '0.00015'}
                onChange={(e) => handleChange('price_twitterapi_io_tweet_read', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">نرخ پروفایل کاربر twitterapi.io ($):</span>
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

      {/* 3. Nitter Instances List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <span>لیست سرورهای عمومی Nitter (هر آدرس در یک خط)</span>
        </h3>
        <p className="text-xs text-slate-400">
          سامانه بین این سرورها گردش کرده و سرورهای ناموفق را تا ۱ ساعت نادیده می‌گیرد.
        </p>
        <textarea
          rows={4}
          value={settings['nitter_instances'] || ''}
          onChange={(e) => handleChange('nitter_instances', e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
          placeholder="https://nitter.privacydev.net"
        />
      </div>

      {/* 4. AI & Digest Schedule */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>پیکربندی هوش مصنوعی (Google Gemini / OpenAI Compatible / OpenRouter)</span>
          </h3>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={settings['ai_enrichment_enabled'] !== '0'}
                onChange={(e) => handleChange('ai_enrichment_enabled', e.target.checked ? '1' : '0')}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500"
              />
              <span>فعال‌سازی ارزیابی هوشمند و ترجمه خودکار</span>
            </label>
          </div>
        </div>

        {/* AI Provider Selector */}
        <div>
          <label className="block text-xs text-slate-300 font-medium mb-2">ارائه‌دهنده سرویس هوش مصنوعی:</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'gemini',
                title: 'Google Gemini',
                subtitle: 'پیش‌فرض AI Studio (Flash / Pro)',
                icon: Sparkles,
                color: 'text-cyan-400',
                border: 'border-cyan-500/40 bg-cyan-500/5',
              },
              {
                id: 'openai',
                title: 'OpenAI Compatible',
                subtitle: 'OpenAI، Groq، DeepSeek، Ollama، LocalAI',
                icon: Cpu,
                color: 'text-emerald-400',
                border: 'border-emerald-500/40 bg-emerald-500/5',
              },
              {
                id: 'openrouter',
                title: 'OpenRouter',
                subtitle: 'دسترسی یکپارچه به Claude، Llama، DeepSeek',
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
                  className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
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
                  <span>تنظیمات Google Gemini</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  سرویس رسمی Gemini SDK با فرمت ساختاریافته (JSON Schema)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">مدل Gemini:</label>
                  <select
                    value={settings['ai_model'] || 'gemini-3.8-flash'}
                    onChange={(e) => handleChange('ai_model', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (جدیدترین نسخه - سریع و بهینه)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (نسخه اقتصادی)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (استدلال تحلیلی عمیق)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    کلید اختصاصی Gemini API (اختیاری):
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings['ai_gemini_api_key'] || ''}
                      onChange={(e) => handleChange('ai_gemini_api_key', e.target.value)}
                      placeholder="در صورت خالی بودن از کلید محیط GEMINI_API_KEY استفاده می‌شود"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] pl-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300"
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
                  <span>تنظیمات ارائه‌دهنده سازگار با OpenAI (OpenAI Compatible)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  پشتیبانی از هر سرور با استاندارد REST /chat/completions
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">آدرس پایه سرور (Base URL):</label>
                  <input
                    type="text"
                    value={settings['ai_openai_base_url'] || 'https://api.openai.com/v1'}
                    onChange={(e) => handleChange('ai_openai_base_url', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">پیش‌فرض‌ها:</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'https://api.openai.com/v1');
                        handleChange('ai_openai_model', 'gpt-4o-mini');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono"
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'https://api.groq.com/openai/v1');
                        handleChange('ai_openai_model', 'llama-3.3-70b-versatile');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono"
                    >
                      Groq
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'https://api.deepseek.com/v1');
                        handleChange('ai_openai_model', 'deepseek-chat');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono"
                    >
                      DeepSeek
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('ai_openai_base_url', 'http://localhost:11434/v1');
                        handleChange('ai_openai_model', 'llama3');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-mono"
                    >
                      Ollama (محلی)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">نام مدل (Model Name):</label>
                  <input
                    type="text"
                    value={settings['ai_openai_model'] || 'gpt-4o-mini'}
                    onChange={(e) => handleChange('ai_openai_model', e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">مدل‌ها:</span>
                    {['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'llama-3.3-70b-versatile'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleChange('ai_openai_model', m)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-mono"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">کلید API (Bearer Token):</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings['ai_openai_api_key'] || ''}
                    onChange={(e) => handleChange('ai_openai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] pl-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300"
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
                  <span>تنظیمات سرویس OpenRouter</span>
                </span>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-purple-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>دریافت کلید از openrouter.ai</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">کلید OpenRouter API Key:</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings['ai_openrouter_api_key'] || ''}
                      onChange={(e) => handleChange('ai_openrouter_api_key', e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px] pl-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">شناسه مدل (Model ID):</label>
                  <input
                    type="text"
                    value={settings['ai_openrouter_model'] || 'openai/gpt-4o-mini'}
                    onChange={(e) => handleChange('ai_openrouter_model', e.target.value)}
                    placeholder="anthropic/claude-3.5-sonnet"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">محبوب‌ترین‌ها:</span>
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
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-purple-300 font-mono"
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
              می‌توانید پیش از ذخیره، عملکرد و صحت اتصال مدل انتخابی را تست کنید:
            </div>
            <button
              type="button"
              onClick={handleTestAi}
              disabled={aiTesting}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-cyan-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiTesting ? 'animate-spin' : ''}`} />
              <span>{aiTesting ? 'در حال آزمون ارتباط...' : 'تست اتصال هوش مصنوعی'}</span>
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
            <label className="block text-slate-300 font-medium mb-1">اندازه بسته ارزیابی (Batch Size):</label>
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
            <label className="block text-slate-300 font-medium mb-1">زمان‌بندی تولید دایجست:</label>
            <select
              value={settings['digest_schedule_type'] || 'daily'}
              onChange={(e) => handleChange('digest_schedule_type', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            >
              <option value="daily">روزانه (یک بار در ساعت مشخص)</option>
              <option value="hourly">ساعتی</option>
              <option value="off">غیرفعال (فقط دستی)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">ساعت ارسال دایجست روزانه:</label>
            <input
              type="time"
              value={settings['digest_daily_time'] || '20:00'}
              onChange={(e) => handleChange('digest_daily_time', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 5. Data Retention & Backup */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="w-4 h-4 text-cyan-400" />
          <span>نگه‌داری داده‌ها و پشتیبان‌گیری دیتابیس</span>
        </h3>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">نگه‌داری پست‌ها تا (روز):</span>
            <input
              type="number"
              value={settings['retention_days'] || '30'}
              onChange={(e) => handleChange('retention_days', e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono"
            />
            <button
              onClick={handleRetentionCleanup}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>پاکسازی دستی اکنون</span>
            </button>
          </div>

          <a
            href="/api/settings/backup"
            download
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center gap-2 font-medium"
          >
            <Download className="w-4 h-4" />
            <span>دانلود فایل پشتیبان SQLite</span>
          </a>
        </div>
      </div>
    </div>
  );
};
