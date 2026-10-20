import React from 'react';
import { useRealtime } from '../context/RealtimeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { usePreferences } from '../context/PreferencesContext.tsx';
import { Search, Play, Pause, LogOut, DollarSign, Sun, Moon, Languages } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  monthSpend?: number;
  totalBudget?: number;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  monthSpend = 0,
  totalBudget = 15,
  onOpenProfile,
}) => {
  const { isPollingPaused, toggleGlobalPause } = useRealtime();
  const { user, username, logout } = useAuth();
  const { lang, toggleLang, theme, toggleTheme, t, isRtl } = usePreferences();

  const spendPercent = totalBudget > 0 ? Math.min(Math.round((monthSpend / totalBudget) * 100), 100) : 0;
  const isBudgetCritical = spendPercent >= 90;

  const displayName = user?.displayName || username || 'Admin';
  const avatarUrl = user?.avatarUrl || '';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
      {/* Search Input */}
      <div className="flex-1 max-w-md relative">
        <div
          className={`absolute inset-y-0 ${
            isRtl ? 'right-0 pr-3.5' : 'left-0 pl-3.5'
          } flex items-center pointer-events-none text-slate-400`}
        >
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t(
            'Search archived posts, translations & authors... (Press /)',
            'جستجو در آرشیو پست‌ها، ترجمه‌ها و نویسندگان... (کلید /)'
          )}
          className={`w-full bg-slate-950/80 border border-slate-800 rounded-xl ${
            isRtl ? 'pr-10 pl-12' : 'pl-10 pr-12'
          } py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all`}
        />
        <div
          className={`absolute inset-y-0 ${
            isRtl ? 'left-0 pl-3' : 'right-0 pr-3'
          } flex items-center pointer-events-none`}
        >
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded font-mono">
            /
          </kbd>
        </div>
      </div>

      {/* Status Controls, Budget Meter, Theme/Language & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Budget Meter */}
        <div className="hidden xl:flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-300 gap-2">
              <span>{t('Month Spend:', 'هزینه ماه:')}</span>
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
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{t('Paused', 'پایش متوقف')}</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t('Live', 'پایش فعال')}</span>
            </div>
          )}

          <button
            onClick={toggleGlobalPause}
            title={
              isPollingPaused
                ? t('Resume Automatic Polling', 'از سرگیری پایش خودکار')
                : t('Pause All Polling', 'توقف موقت تمام پایش‌ها')
            }
            className={`p-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isPollingPaused
                ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {isPollingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span className="hidden md:inline">
              {isPollingPaused ? t('Resume', 'ادامه پایش') : t('Pause All', 'توقف همه')}
            </span>
          </button>
        </div>

        {/* Language Toggle (EN / FA) */}
        <button
          onClick={toggleLang}
          title={t('Switch Language to Persian (فارسی)', 'تغییر زبان به انگلیسی (English)')}
          className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Languages className="w-4 h-4 text-cyan-400" />
          <span className="font-mono">{lang === 'en' ? 'FA' : 'EN'}</span>
        </button>

        {/* Theme Toggle (Dark / Light) */}
        <button
          onClick={toggleTheme}
          title={
            theme === 'dark'
              ? t('Switch to Light Mode', 'تغییر به حالت روشن (لایت)')
              : t('Switch to Dark Mode', 'تغییر به حالت تیره (دارک)')
          }
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-cyan-400" />
          )}
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-1.5 border-s border-slate-800 ps-2.5 sm:ps-3">
          <button
            onClick={onOpenProfile}
            title={t('Profile & Account Settings', 'تنظیمات پروفایل و حساب کاربری')}
            className="flex items-center gap-2 p-1 pe-2.5 rounded-xl hover:bg-slate-800/70 border border-transparent hover:border-slate-700 transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 overflow-hidden flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="hidden md:flex flex-col text-start max-w-[110px]">
              <span className="text-xs font-bold text-slate-200 truncate leading-tight">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono truncate leading-tight" dir="ltr">
                @{username || 'admin'}
              </span>
            </div>
          </button>

          <button
            onClick={logout}
            title={t('Sign Out', 'خروج از حساب')}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

