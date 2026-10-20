import React, { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext.tsx';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext.tsx';
import { Sidebar, ActiveTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { FeedView } from './components/Feed/FeedView.tsx';
import { SourcesView } from './components/Sources/SourcesView.tsx';
import { SchedulerView } from './components/Scheduler/SchedulerView.tsx';
import { DigestsView } from './components/Digests/DigestsView.tsx';
import { AlertsView } from './components/Alerts/AlertsView.tsx';
import { UsageView } from './components/Usage/UsageView.tsx';
import { ScraperAccountsView } from './components/Scraper/ScraperAccountsView.tsx';
import { ProfileView } from './components/Profile/ProfileView.tsx';
import { SettingsView } from './components/Settings/SettingsView.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { apiRequest } from './utils/api.ts';
import { AlertTriangle, X, ExternalLink, Menu } from 'lucide-react';

const queryClient = new QueryClient();

function MainDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { budgetWarning, dismissBudgetWarning, recentAlerts, dismissAlert } = useRealtime();
  const { t, isRtl } = usePreferences();

  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [sourcesCount, setSourcesCount] = useState(0);
  const [monthSpend, setMonthSpend] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on `/`
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch summary counts
  const fetchCounts = async () => {
    try {
      const [unreadData, sourcesData, usageData] = await Promise.all([
        apiRequest<{ unread: number }>('/api/posts/unread-counts'),
        apiRequest<any[]>('/api/sources'),
        apiRequest<any>('/api/usage'),
      ]);
      setUnreadCount(unreadData.unread);
      setSourcesCount(sourcesData.length);
      setMonthSpend(usageData.summary?.monthTotalSpend || 0);
    } catch {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCounts();
      const interval = setInterval(fetchCounts, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        {t('Loading X Monitor...', 'در حال بارگذاری سامانه...')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  const getTabLabel = (tab: ActiveTab) => {
    switch (tab) {
      case 'feed':
        return t('Live Feed', 'جریان اخبار');
      case 'sources':
        return t('Sources', 'منابع پایش');
      case 'scheduler':
        return t('Scheduler', 'زمان‌بندی');
      case 'digests':
        return t('Digests', 'خلاصه‌ها');
      case 'alerts':
        return t('Alerts', 'هشدارها');
      case 'usage':
        return t('Usage & Costs', 'مصرف و هزینه');
      case 'scraper':
        return t('Scraper Accounts', 'حساب‌های اسکرپر');
      case 'profile':
        return t('Profile Settings', 'تنظیمات پروفایل');
      default:
        return t('Settings', 'تنظیمات');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-row transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }}
        unreadCount={unreadCount}
        sourcesCount={sourcesCount}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
          monthSpend={monthSpend}
          onOpenProfile={() => setActiveTab('profile')}
        />

        {/* Mobile menu bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 text-slate-300 hover:text-slate-100 rounded-lg bg-slate-800 flex items-center gap-2 text-xs"
          >
            <Menu className="w-4 h-4" />
            <span>{t('Navigation Menu', 'منوی بخش‌ها')}</span>
          </button>
          <span className="text-xs font-bold text-cyan-400">{getTabLabel(activeTab)}</span>
        </div>

        {/* Budget Warning Banner if triggered */}
        {budgetWarning && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 px-6 py-3 flex items-center justify-between gap-3 text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span className="font-bold">{budgetWarning}</span>
            </div>
            <button
              onClick={dismissBudgetWarning}
              className="p-1 text-rose-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* In-App Alert Toasts */}
        {recentAlerts.length > 0 && (
          <div className={`fixed bottom-5 ${isRtl ? 'left-5' : 'right-5'} z-50 space-y-2 max-w-sm`}>
            {recentAlerts.map((alt) => (
              <div
                key={alt.id}
                className="bg-slate-900/95 border border-cyan-500/50 p-3.5 rounded-2xl shadow-xl shadow-cyan-500/10 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-cyan-300">{alt.title}</div>
                  <div className="text-slate-300 mt-0.5 line-clamp-2">{alt.message}</div>
                  {alt.url && (
                    <a
                      href={alt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 mt-1 font-medium"
                    >
                      <span>{t('View Post on X', 'مشاهده پست در X')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => dismissAlert(alt.id)}
                  className="p-1 text-slate-400 hover:text-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* View Routing */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'feed' && <FeedView searchQuery={searchQuery} />}
          {activeTab === 'sources' && <SourcesView />}
          {activeTab === 'scheduler' && <SchedulerView />}
          {activeTab === 'digests' && <DigestsView />}
          {activeTab === 'alerts' && <AlertsView />}
          {activeTab === 'usage' && <UsageView />}
          {activeTab === 'scraper' && <ScraperAccountsView />}
          {activeTab === 'profile' && <ProfileView />}
          {activeTab === 'settings' && <SettingsView onOpenProfile={() => setActiveTab('profile')} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <AuthProvider>
          <RealtimeProvider>
            <MainDashboard />
          </RealtimeProvider>
        </AuthProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}

