import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.ts';
import { toRelativeTimeFa, toJalaliDate, toPersianDigits } from '../../utils/date.ts';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { Clock, AlertTriangle, ShieldCheck, Play, Pause, RefreshCw } from 'lucide-react';

interface QueueItem {
  id: string;
  value: string;
  type: string;
  provider: string;
  groupName?: string;
  lastPolledAt?: string;
  nextPollAt?: string;
  remainingSeconds: number;
  lastError?: string;
  consecutiveFailures: number;
  effectiveIntervalMinutes: number;
  effectiveLevel: string;
}

export const SchedulerView: React.FC = () => {
  const { isPollingPaused, toggleGlobalPause } = useRealtime();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const data = await apiRequest<{ isPaused: boolean; queue: QueueItem[] }>('/api/scheduler/queue');
      setQueue(data.queue);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return 'در حال آماده‌سازی یا اجرا...';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${toPersianDigits(s)} ثانیه دیگر`;
    return `${toPersianDigits(m)} دقیقه و ${toPersianDigits(s)} ثانیه دیگر`;
  };

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>صف زمان‌بندی و پایش خودکار</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            منابع به ترتیب نزدیک‌ترین زمان پایش لیست شده‌اند. جیتر تصادفی (±۲۰٪) به صورت خودکار مانع از هم‌زمانی درخواست‌ها می‌شود.
          </p>
        </div>

        <button
          onClick={toggleGlobalPause}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
            isPollingPaused
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
          }`}
        >
          {isPollingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          <span>{isPollingPaused ? 'ادامه پایش سراسری' : 'توقف تمام پایش‌ها'}</span>
        </button>
      </div>

      {/* Provider Floors info box */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400">کف مجاز twscrape حساب:</div>
          <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">۱۵ دقیقه</div>
          <div className="text-[10px] text-slate-500 mt-1">جلوگیری از قفل شدن اکانت</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400">کف مجاز twscrape جستجو:</div>
          <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">۳۰ دقیقه</div>
          <div className="text-[10px] text-slate-500 mt-1">کاهش نرخ درخواست‌های جستجو</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400">کف مجاز Nitter RSS:</div>
          <div className="text-base font-bold text-indigo-400 font-mono mt-0.5">۱۰ دقیقه</div>
          <div className="text-[10px] text-slate-500 mt-1">حفظ سلامت سرورهای عمومی</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400">کف مجاز Official X:</div>
          <div className="text-base font-bold text-amber-400 font-mono mt-0.5">۱۵ دقیقه</div>
          <div className="text-[10px] text-slate-500 mt-1">کنترل هزینه سقف بودجه</div>
        </div>
      </div>

      {/* Queue List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">
            صف اجرای بعدی ({toPersianDigits(queue.length)} منبع فعال)
          </h3>
          <button
            onClick={fetchQueue}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="به‌روزرسانی صف"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">در حال بارگذاری صف...</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">هیچ منبع فعالی در صف وجود ندارد.</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {queue.map((item, idx) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/90 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 font-mono text-xs flex items-center justify-center text-slate-400">
                    {toPersianDigits(idx + 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-200">
                        {item.type === 'account' ? `@${item.value}` : item.value}
                      </span>
                      {item.groupName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {item.groupName}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 font-mono">({item.provider})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      تناوب: هر {toPersianDigits(item.effectiveIntervalMinutes)} دقیقه • آخرین پایش:{' '}
                      {item.lastPolledAt ? toRelativeTimeFa(item.lastPolledAt) : 'هنوز انجام نشده'}
                    </div>
                  </div>
                </div>

                <div className="text-left font-mono">
                  <div className="text-xs font-bold text-cyan-400">
                    {formatRemaining(item.remainingSeconds)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {item.nextPollAt ? toJalaliDate(item.nextPollAt) : '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
