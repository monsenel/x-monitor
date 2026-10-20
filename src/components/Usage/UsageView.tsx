import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { toPersianDigits } from '../../utils/date.ts';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export const UsageView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/usage')
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !data) {
    return <div className="p-12 text-center text-slate-500 text-xs">در حال محاسبه و استخراج آمار مصرف...</div>;
  }

  const { summary, dailyTrends, perSource, aiUsage, rateLimits } = data;
  const totalBudget = summary.budgets.total || 15;
  const monthSpend = summary.monthTotalSpend || 0;
  const budgetPercent = Math.min(Math.round((monthSpend / totalBudget) * 100), 100);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Month Spend */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="text-xs text-slate-400 font-medium">هزینه کل ماه جاری:</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            ${monthSpend.toFixed(3)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            از سقف بودجه ${totalBudget} ({toPersianDigits(budgetPercent)}٪)
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
          <div className="text-xs text-slate-400 font-medium">هزینه تخمینی تا پایان ماه:</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            ${summary.projectedMonthEnd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>بر مبنای میانگین مصرف روزانه</span>
          </div>
        </div>

        {/* Free Providers Saved */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">پست‌های دریافت‌شده رایگان:</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {toPersianDigits(
              (summary.spendMonthByProvider['twscrape']?.posts || 0) +
                (summary.spendMonthByProvider['nitter-rss']?.posts || 0)
            )}
          </div>
          <div className="text-[11px] text-emerald-400 mt-2 font-medium">
            ۱۰۰٪ صرفه‌جویی هزینه از طریق twscrape و Nitter
          </div>
        </div>

        {/* Paid Providers Calls */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">فراخوانی ارائه‌دهندگان پرداختی:</div>
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
            <span>تفکیک مصرف بر اساس ارائه‌دهندگان داده</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">ارائه‌دهنده</th>
                <th className="py-3 px-4">مدل هزینه</th>
                <th className="py-3 px-4">تعداد فراخوانی</th>
                <th className="py-3 px-4">پست‌های خوانده‌شده</th>
                <th className="py-3 px-4">هزینه کل ماه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">twscrape (سایدکار داخلی)</td>
                <td className="py-3 px-4 text-emerald-400 font-sans">رایگان (پیش‌فرض)</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['twscrape']?.calls || 0)}</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['twscrape']?.posts || 0)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">$0.00</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">Nitter RSS (فید عمومی)</td>
                <td className="py-3 px-4 text-emerald-400 font-sans">رایگان (پشتیبان)</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['nitter-rss']?.calls || 0)}</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['nitter-rss']?.posts || 0)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">$0.00</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">Official X API v2</td>
                <td className="py-3 px-4 text-amber-400 font-sans">پولی (Per Tweet Read)</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['x-official']?.calls || 0)}</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['x-official']?.posts || 0)}</td>
                <td className="py-3 px-4 text-amber-400 font-bold">${summary.spendMonthByProvider['x-official']?.spend.toFixed(3) || '0.000'}</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-sans font-medium text-slate-200">twitterapi.io</td>
                <td className="py-3 px-4 text-amber-400 font-sans">پولی (Per Item Returned)</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['twitterapi-io']?.calls || 0)}</td>
                <td className="py-3 px-4 text-slate-300">{toPersianDigits(summary.spendMonthByProvider['twitterapi-io']?.posts || 0)}</td>
                <td className="py-3 px-4 text-amber-400 font-bold">${summary.spendMonthByProvider['twitterapi-io']?.spend.toFixed(3) || '0.000'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Noisiest Sources Breakdown */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">
            پرمصرف‌ترین منابع (Noisiest Sources)
          </h3>
          <span className="text-[11px] text-slate-500">مرتب‌شده بر مبنای هزینه و حجم دریافت</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">منبع</th>
                <th className="py-3 px-4">نوع</th>
                <th className="py-3 px-4">ارائه‌دهنده</th>
                <th className="py-3 px-4">پست‌های دریافت‌شده</th>
                <th className="py-3 px-4">فراخوانی‌ها</th>
                <th className="py-3 px-4">هزینه تخمینی</th>
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
          <span>مصرف هوش مصنوعی Gemini (Server-side)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {aiUsage.map((u: any, idx: number) => (
            <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium capitalize">
                عملیات: {u.operation === 'enrichment' ? 'تحلیل پست‌ها' : u.operation === 'cluster' ? 'کلاسترینگ' : 'خلاصه دایجست'}
              </div>
              <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                {toPersianDigits(u.total_input + u.total_output)} توکن
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                هزینه تخمینی: ${Number(u.total_cost || 0).toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
