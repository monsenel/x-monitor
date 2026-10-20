import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { toPersianDigits } from '../utils/date.ts';
import { apiRequest } from '../utils/api.ts';

interface RealtimeContextType {
  pendingNewPostsCount: number;
  clearPendingNewPosts: () => void;
  isPollingPaused: boolean;
  toggleGlobalPause: () => Promise<void>;
  budgetWarning: string | null;
  dismissBudgetWarning: () => void;
  recentAlerts: { id: string; title: string; message: string; url?: string }[];
  dismissAlert: (id: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  pendingNewPostsCount: 0,
  clearPendingNewPosts: () => {},
  isPollingPaused: false,
  toggleGlobalPause: async () => {},
  budgetWarning: null,
  dismissBudgetWarning: () => {},
  recentAlerts: [],
  dismissAlert: () => {},
});

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [pendingNewPostsCount, setPendingNewPostsCount] = useState(0);
  const [isPollingPaused, setIsPollingPaused] = useState(false);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<{ id: string; title: string; message: string; url?: string }[]>([]);

  // Update document title with unread counter
  useEffect(() => {
    if (pendingNewPostsCount > 0) {
      document.title = `(${toPersianDigits(pendingNewPostsCount)}) X Monitor`;
    } else {
      document.title = 'X Monitor';
    }
  }, [pendingNewPostsCount]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('xmonitor_token') || '' : '';
      const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('new_posts', (e) => {
        try {
          const data = JSON.parse(e.data);
          const count = Number(data.count) || 1;
          setPendingNewPostsCount((prev) => prev + count);
        } catch {}
      });

      eventSource.addEventListener('budget_warning', (e) => {
        try {
          const data = JSON.parse(e.data);
          setBudgetWarning(data.message);
        } catch {}
      });

      eventSource.addEventListener('alert', (e) => {
        try {
          const data = JSON.parse(e.data);
          setRecentAlerts((prev) => [
            { id: `alert-${Date.now()}`, title: data.title, message: data.message, url: data.url },
            ...prev.slice(0, 4),
          ]);
        } catch {}
      });

      eventSource.addEventListener('polling_status', (e) => {
        try {
          const data = JSON.parse(e.data);
          setIsPollingPaused(!!data.paused);
        } catch {}
      });

      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [isAuthenticated]);

  const clearPendingNewPosts = useCallback(() => {
    setPendingNewPostsCount(0);
  }, []);

  const toggleGlobalPause = async () => {
    try {
      const data = await apiRequest<{ paused: boolean }>('/api/settings/toggle-global-pause', {
        method: 'POST',
      });
      setIsPollingPaused(!!data.paused);
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    }
  };

  const dismissBudgetWarning = () => setBudgetWarning(null);

  const dismissAlert = (id: string) => {
    setRecentAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <RealtimeContext.Provider
      value={{
        pendingNewPostsCount,
        clearPendingNewPosts,
        isPollingPaused,
        toggleGlobalPause,
        budgetWarning,
        dismissBudgetWarning,
        recentAlerts,
        dismissAlert,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
