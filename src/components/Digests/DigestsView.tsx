import React, { useState, useEffect } from 'react';
import { DigestItem } from '../../types.ts';
import { apiRequest } from '../../utils/api.ts';
import { toJalaliDate, toRelativeTimeFa, toPersianDigits } from '../../utils/date.ts';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { Sparkles, Calendar, Layers, BookOpen } from 'lucide-react';

export const DigestsView: React.FC = () => {
  const { t } = usePreferences();
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [digestsData, clustersData] = await Promise.all([
        apiRequest<DigestItem[]>('/api/digests'),
        apiRequest<any[]>('/api/digests/clusters'),
      ]);
      setDigests(digestsData);
      setClusters(clustersData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateDigest = async () => {
    setIsGenerating(true);
    setStatusBanner(null);
    try {
      const res = await apiRequest<{ ok: boolean; digest: DigestItem }>('/api/digests/generate', { method: 'POST' });
      setStatusBanner({
        ok: true,
        message: t('AI digest generated successfully!', 'خلاصه اخبار با موفقیت توسط هوش مصنوعی تولید شد!'),
      });
      setDigests((prev) => [res.digest, ...prev]);
    } catch (err: any) {
      setStatusBanner({
        ok: false,
        message: `${t('Failed to generate digest:', 'خطا در تولید خلاصه:')} ${err.message}`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunClustering = async () => {
    setIsClustering(true);
    setStatusBanner(null);
    try {
      const res = await apiRequest<{ ok: boolean; createdCount: number }>('/api/digests/cluster-now', { method: 'POST' });
      setStatusBanner({
        ok: true,
        message: t(
          `${res.createdCount} event clusters created from the last 24h posts.`,
          `${toPersianDigits(res.createdCount)} کلاستر جدید برای پست‌های ۲۴ ساعت اخیر تشکیل شد.`
        ),
      });
      loadData();
    } catch (err: any) {
      setStatusBanner({
        ok: false,
        message: `${t('Clustering error:', 'خطا در کلاسترینگ:')} ${err.message}`,
      });
    } finally {
      setIsClustering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>{t('Smart Analytical Digests & Clustering', 'خلاصه‌های تحلیلی هوشمند (Digests & Clustering)')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'AI automatically clusters recurring event topics and generates executive summaries.',
              'هوش مصنوعی پست‌های پرتکرار را دسته‌بندی و در بازه‌های زمانی خلاصه‌سازی می‌کند.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunClustering}
            disabled={isClustering}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {isClustering
                ? t('Clustering...', 'در حال کلاسترینگ...')
                : t('Cluster Recent Posts', 'کلاسترینگ پست‌های اخیر')}
            </span>
          </button>

          <button
            onClick={handleGenerateDigest}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isGenerating
                ? t('Generating Digest...', 'در حال تولید خلاصه هوشمند...')
                : t('Generate New Digest', 'تولید دایجست جدید')}
            </span>
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

      {/* Active Clusters section */}
      {clusters.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{t('Active Event Clusters (Last 24 Hours)', 'خوشه‌های فعال رویدادها (کلاسترهای ۲۴ ساعت اخیر)')}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusters.map((c) => (
              <div key={c.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-xs text-slate-200 leading-snug">{c.title}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono">
                    {toPersianDigits(c.post_count)} {t('posts', 'پست')}
                  </span>
                </div>
                {c.summary && <p className="text-[11px] text-slate-400 leading-relaxed">{c.summary}</p>}
                <div className="text-[10px] text-slate-500 font-mono pt-1">
                  {t('Created:', 'تشکیل‌شده:')} {toRelativeTimeFa(c.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Digests */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>{t('Digests & Executive Summaries Archive', 'آرشیو دایجست‌ها و خلاصه‌ها')}</span>
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {t('Loading digests...', 'در حال بارگذاری خلاصه‌ها...')}
          </div>
        ) : digests.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <p className="text-slate-400 text-sm">
              {t('No digests have been generated yet.', 'تاکنون خلاصه‌ای تولید نشده است.')}
            </p>
            <p className="text-slate-500 text-xs mt-1">
              {t(
                'Click "Generate New Digest" above to create an instant summary of the past 24 hours.',
                'با فشردن دکمه «تولید دایجست جدید» می‌توانید بلافاصله خلاصه رویدادهای ۲۴ ساعت گذشته را دریافت کنید.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {digests.map((d) => (
              <article key={d.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-bold text-base text-slate-100">{d.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {t('Period:', 'بازه:')} {toJalaliDate(d.period_start)} {t('to', 'تا')} {toJalaliDate(d.period_end)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{toRelativeTimeFa(d.created_at)}</span>
                </div>

                {/* Content */}
                <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-line select-text" dir="auto">
                  {d.content}
                </div>

                {/* Group summaries if present */}
                {d.group_summaries && Object.keys(d.group_summaries).length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="text-xs font-bold text-slate-400">
                      {t('Category Breakdown:', 'خلاصه‌های موضوعی:')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(d.group_summaries).map(([grp, sum], idx) => (
                        <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                          <span className="font-bold text-cyan-400 block mb-1">{grp}:</span>
                          <span className="text-slate-300">{sum}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

