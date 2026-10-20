import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { toPersianDigits } from '../../utils/date.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import {
  TrendingUp,
  BarChart3,
  Zap,
} from 'lucide-react';

export const UsageView: React.FC = () => {
  const { t, isRtl } = usePreferences();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/usage')
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !data) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        {t('Calculating usage and cost analytics...', 'در حال محاسبه و استخراج آمار مصرف...')}
      </div>
    );
  }

  const { summary, perSource, aiUsage } = data;
  const totalBudget = summary.budgets.total || 15;
  const monthSpend = summary.monthTotalSpend || 0;
  const budgetPercent = Math.min(Math.round((monthSpend / totalBudget) * 100), 100);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Month Spend */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="text-xs text-slate-400 font-medium">
            {t('Current Month Total Spend:', 'هزینه کل ماه جاری:')}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            ${monthSpend.toFixed(3)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {t(
              `of $${totalBudget} budget (${budgetPercent}%)`,
              `از سقف بودجه $${totalBudget} (${toPersianDigits(budgetPercent)}٪)`
            )}
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full ${budgetPercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>

        {/* Projected Month-End */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">
            {t('Projected Month-End Spend:', 'هزینه تخمینی تا پایان ماه:')}
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            ${summary.projectedMonthEnd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('Based on daily average spend', 'بر مبنای میانگین مصرف روزانه')}</span>
          </div>
        </div>

        {/* Free Providers Saved */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">
            {t('Posts Fetched via Free Providers:', 'پست‌های دریافت‌شده رایگان:')}
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {toPersianDigits(
              (summary.spendMonthByProvider['twscrape']?.posts || 0) +
                (summary.spendMonthByProvider['nitter-rss']?.posts || 0)
            )}
          </div>
          <div className="text-[11px] text-emerald-400 mt-2 font-medium">
            {t(
              '100% cost savings via twscrape & Nitter',
              '۱۰۰٪ صرفه‌جویی هزینه از طریق twscrape و Nitter'
            )}
          </div>
        </div>

        {/* Paid Providers Calls */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">
            {t('Paid Provider API Calls:', 'فراخوانی ارائه‌دهندگان پرداختی:')}
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {toPersianDigits(
              (summary.spendMonthByProvider['x-official']?.calls || 0) +
                (summary.spendMonthByProvider['twitterapi-io']?.calls || 0)
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            X Official: ${summary.spendMonthByProvider['x-official']?.spend || 0}
          </div>
        </div>
      </div>

      {/* Provider Breakdown Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>{t('Usage Breakdown by Data Provider', 'تفکیک مصرف بر اساس ارائه‌دهندگان داده')}</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">{t('Provider', 'ارائه‌دهنده')}</th>
                <th className="py-3 px-4">{t('Pricing Model', 'مدل هزینه')}</th>
                <th className="py-3 px-4">{t('API Calls', 'تعداد فراخوانی')}</th>
                <th className="py-3 px-4">{t('Posts Read', 'پست‌های خوانده‌شده')}</th>
                <th className="py-3 px-4">{t('Monthly Cost', 'هزینه کل ماه')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">
                  {t('twscrape (Internal Sidecar)', 'twscrape (سایدکار داخلی)')}
                </td>
                <td className="py-3 px-4 text-emerald-400 font-sans">
                  {t('Free (Default)', 'رایگان (پیش‌فرض)')}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['twscrape']?.calls || 0)}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['twscrape']?.posts || 0)}
                </td>
                <td className="py-3 px-4 text-emerald-400 font-bold">$0.00</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">
                  {t('Nitter RSS (Public Feed)', 'Nitter RSS (فید عمومی)')}
                </td>
                <td className="py-3 px-4 text-emerald-400 font-sans">
                  {t('Free (Fallback)', 'رایگان (پشتیبان)')}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['nitter-rss']?.calls || 0)}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['nitter-rss']?.posts || 0)}
                </td>
                <td className="py-3 px-4 text-emerald-400 font-bold">$0.00</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">Official X API v2</td>
                <td className="py-3 px-4 text-amber-400 font-sans">
                  {t('Paid (Per Tweet Read)', 'پولی (Per Tweet Read)')}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['x-official']?.calls || 0)}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['x-official']?.posts || 0)}
                </td>
                <td className="py-3 px-4 text-amber-400 font-bold">
                  ${summary.spendMonthByProvider['x-official']?.spend.toFixed(3) || '0.000'}
                </td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">twitterapi.io</td>
                <td className="py-3 px-4 text-amber-400 font-sans">
                  {t('Paid (Per Item Returned)', 'پولی (Per Item Returned)')}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['twitterapi-io']?.calls || 0)}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {toPersianDigits(summary.spendMonthByProvider['twitterapi-io']?.posts || 0)}
                </td>
                <td className="py-3 px-4 text-amber-400 font-bold">
                  ${summary.spendMonthByProvider['twitterapi-io']?.spend.toFixed(3) || '0.000'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Noisiest Sources Breakdown */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">
            {t('Highest Volume Sources (Noisiest Sources)', 'پرمصرف‌ترین منابع (Noisiest Sources)')}
          </h3>
          <span className="text-[11px] text-slate-500">
            {t('Sorted by cost & ingestion volume', 'مرتب‌شده بر مبنای هزینه و حجم دریافت')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">{t('Source', 'منبع')}</th>
                <th className="py-3 px-4">{t('Type', 'نوع')}</th>
                <th className="py-3 px-4">{t('Provider', 'ارائه‌دهنده')}</th>
                <th className="py-3 px-4">{t('Posts Fetched', 'پست‌های دریافت‌شده')}</th>
                <th className="py-3 px-4">{t('Calls', 'فراخوانی‌ها')}</th>
                <th className="py-3 px-4">{t('Est. Cost', 'هزینه تخمینی')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {perSource.slice(0, 8).map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-200">{s.value}</td>
                  <td className="py-3 px-4 text-slate-400">{s.type}</td>
                  <td className="py-3 px-4 text-slate-400">{s.provider || 'twscrape'}</td>
                  <td className="py-3 px-4 font-mono">{toPersianDigits(s.total_posts)}</td>
                  <td className="py-3 px-4 font-mono">{toPersianDigits(s.total_calls)}</td>
                  <td className="py-3 px-4 font-mono text-cyan-400">${Number(s.total_cost || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Usage Breakdown */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>{t('AI Token & Cost Usage (Server-side)', 'مصرف هوش مصنوعی (Server-side)')}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {aiUsage.length === 0 ? (
            <div className="col-span-3 text-xs text-slate-500 py-3 text-center">
              {t('No AI transactions recorded this month.', 'هنوز تراکنش هوش مصنوعی در ماه جاری ثبت نشده است.')}
            </div>
          ) : (
            aiUsage.map((u: any, idx: number) => {
              const op = String(u.operation || '');
              const opLabel = op.includes('enrichment')
                ? t('Post Analysis & Translation', 'تحلیل و ترجمه پست‌ها')
                : op.includes('cluster')
                ? t('Event Clustering', 'کلاسترینگ رویدادها')
                : op.includes('test')
                ? t('Connection Test', 'آزمون اتصال')
                : t('Digest Summary', 'خلاصه دایجست');
              return (
                <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">
                    {t('Operation:', 'عملیات:')} {opLabel}
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                    {toPersianDigits((u.total_input || 0) + (u.total_output || 0))}{' '}
                    {t('tokens', 'توکن')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {t('Est. Cost:', 'هزینه تخمینی:')} ${Number(u.total_cost || 0).toFixed(4)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

