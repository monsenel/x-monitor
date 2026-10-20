import React from 'react';
import { useRealtime } from '../context/RealtimeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { toPersianDigits } from '../utils/date.ts';
import { Search, Play, Pause, AlertTriangle, LogOut, Activity, DollarSign } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  monthSpend?: number;
  totalBudget?: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  monthSpend = 0,
  totalBudget = 15,
}) => {
  const { isPollingPaused, toggleGlobalPause, budgetWarning } = useRealtime();
  const { username, logout } = useAuth();

  const spendPercent = totalBudget > 0 ? Math.min(Math.round((monthSpend / totalBudget) * 100), 100) : 0;
  const isBudgetCritical = spendPercent >= 90;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Search Input */}
      <div className="flex-1 max-w-md relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو در آرشیو پست‌ها، ترجمه‌ها و نویسندگان... (کلید /)"
          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pr-10 pl-12 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded font-mono">
            /
          </kbd>
        </div>
      </div>

      {/* Status Controls & Budget Meter */}
      <div className="flex items-center gap-3 sm:gap-4 mr-4">
        {/* Budget Meter */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-300 gap-2">
              <span>هزینه ماه:</span>
              <span className="font-mono text-emerald-400">${monthSpend.toFixed(2)}</span>
              <span className="text-slate-500">/ ${totalBudget}</span>
            </div>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-500 ${
                  isBudgetCritical ? 'bg-rose-500' : spendPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${spendPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Polling Status Indicator & Toggle */}
        <div className="flex items-center gap-2">
          {isPollingPaused ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>پایش متوقف</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>پایش فعال</span>
            </div>
          )}

          <button
            onClick={toggleGlobalPause}
            title={isPollingPaused ? 'از سرگیری پایش خودکار' : 'توقف موقت تمام پایش‌ها'}
            className={`p-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-1.5 ${
              isPollingPaused
                ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {isPollingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span className="hidden md:inline">{isPollingPaused ? 'ادامه پایش' : 'توقف همه'}</span>
          </button>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-2 border-r border-slate-800 pr-3 sm:pr-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            {username ? username[0].toUpperCase() : 'A'}
          </div>
          <button
            onClick={logout}
            title="خروج از حساب"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
