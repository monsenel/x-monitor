import React from 'react';
import {
  Radio,
  Rss,
  Clock,
  Sparkles,
  Bell,
  BarChart3,
  Bot,
  Settings,
  UserCircle,
  X,
} from 'lucide-react';
import { toPersianDigits } from '../utils/date.ts';
import { usePreferences } from '../context/PreferencesContext.tsx';

export type ActiveTab =
  | 'feed'
  | 'sources'
  | 'scheduler'
  | 'digests'
  | 'alerts'
  | 'usage'
  | 'scraper'
  | 'profile'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unreadCount?: number;
  sourcesCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  sourcesCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { t, isRtl } = usePreferences();

  const menuItems = [
    {
      id: 'feed' as ActiveTab,
      label: t('Live Feed', 'جریان اخبار (Feed)'),
      icon: Radio,
      badge: unreadCount > 0 ? toPersianDigits(unreadCount) : undefined,
      badgeColor: 'bg-cyan-500 text-slate-950',
    },
    {
      id: 'sources' as ActiveTab,
      label: t('Monitored Sources', 'منابع پایش (Sources)'),
      icon: Rss,
      badge: sourcesCount > 0 ? toPersianDigits(sourcesCount) : undefined,
      badgeColor: 'bg-slate-800 text-slate-300',
    },
    {
      id: 'scheduler' as ActiveTab,
      label: t('Scheduler & Queue', 'زمان‌بندی و صف پایش'),
      icon: Clock,
    },
    {
      id: 'digests' as ActiveTab,
      label: t('Smart Digests & Clusters', 'خلاصه‌های هوشمند و کلاستر'),
      icon: Sparkles,
    },
    {
      id: 'alerts' as ActiveTab,
      label: t('Alerts & Rules', 'هشدارها و قوانین'),
      icon: Bell,
    },
    {
      id: 'usage' as ActiveTab,
      label: t('Usage & Cost Analytics', 'مصرف و تحلیل هزینه'),
      icon: BarChart3,
    },
    {
      id: 'scraper' as ActiveTab,
      label: t('Scraper Accounts', 'حساب‌های اسکرپر'),
      icon: Bot,
    },
    {
      id: 'profile' as ActiveTab,
      label: t('Profile Settings', 'تنظیمات پروفایل'),
      icon: UserCircle,
    },
    {
      id: 'settings' as ActiveTab,
      label: t('System Settings', 'تنظیمات سامانه'),
      icon: Settings,
    },
  ];

  const handleSelect = (tab: ActiveTab) => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 ${
          isRtl ? 'right-0 border-l' : 'left-0 border-r'
        } z-50 w-64 h-screen shrink-0 bg-slate-900 border-slate-800 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:z-30 ${
          isOpenMobile ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 shrink-0 border-b border-slate-800 flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-100 tracking-wide flex items-center gap-1.5">
                X Monitor
              </h1>
              <p className="text-[10px] text-cyan-400 font-medium">
                {t('Intelligent X Monitoring', 'پایش هوشمند توییتر')}
              </p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2.5 space-y-1 overflow-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3.5 shrink-0 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
          <span>{t('v1.2.0', 'نگارش ۱.۲.۰')}</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{t('Live Engine', 'سامانه پایش زنده')}</span>
          </span>
        </div>
      </aside>
    </>
  );
};

