import React, { useState, useEffect, useCallback } from 'react';
import { Post, Source, SourceGroup } from '../../types.ts';
import { PostCard } from './PostCard.tsx';
import { apiRequest } from '../../utils/api.ts';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { usePreferences } from '../../context/PreferencesContext.tsx';
import { toPersianDigits } from '../../utils/date.ts';
import {
  Filter,
  CheckCheck,
  Download,
  Layers,
  Sparkles,
  ArrowUp,
  SearchX,
  Bookmark,
  Image as ImageIcon,
} from 'lucide-react';

interface FeedViewProps {
  searchQuery: string;
}

export const FeedView: React.FC<FeedViewProps> = ({ searchQuery }) => {
  const { pendingNewPostsCount, clearPendingNewPosts } = useRealtime();
  const { t } = usePreferences();

  const [posts, setPosts] = useState<Post[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Filters state
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [hasMediaOnly, setHasMediaOnly] = useState(false);
  const [minImportance, setMinImportance] = useState<number>(0);
  const [clusterViewMode, setClusterViewMode] = useState(false);

  // Fetch sources and groups for filter dropdowns
  const fetchFiltersData = async () => {
    try {
      const [srcData, grpData] = await Promise.all([
        apiRequest<Source[]>('/api/sources'),
        apiRequest<SourceGroup[]>('/api/sources/groups/all'),
      ]);
      setSources(srcData);
      setGroups(grpData);
    } catch {}
  };

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '40',
        offset: '0',
      });

      if (searchQuery) params.set('search', searchQuery);
      if (selectedSourceId) params.set('sourceId', selectedSourceId);
      if (selectedGroupId) params.set('groupId', selectedGroupId);
      if (unreadOnly) params.set('unreadOnly', 'true');
      if (bookmarkedOnly) params.set('bookmarked', 'true');
      if (hasMediaOnly) params.set('hasMedia', 'true');
      if (minImportance > 0) params.set('minImportance', String(minImportance));

      const data = await apiRequest<{ posts: Post[]; total: number }>(`/api/posts?${params.toString()}`);
      setPosts(data.posts);
      setTotalCount(data.total);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedSourceId, selectedGroupId, unreadOnly, bookmarkedOnly, hasMediaOnly, minImportance]);

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Handle "Load N New Posts" banner click
  const handleLoadNewPosts = () => {
    clearPendingNewPosts();
    fetchPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard navigation: j/k, m, b, o
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'j') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, posts.length - 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'm' && selectedIndex >= 0 && selectedIndex < posts.length) {
        e.preventDefault();
        const p = posts[selectedIndex];
        handleToggleRead(p.id, p.isRead);
      } else if (e.key === 'b' && selectedIndex >= 0 && selectedIndex < posts.length) {
        e.preventDefault();
        const p = posts[selectedIndex];
        handleToggleBookmark(p.id, p.isBookmarked);
      } else if (e.key === 'o' && selectedIndex >= 0 && selectedIndex < posts.length) {
        e.preventDefault();
        window.open(posts[selectedIndex].url, '_blank', 'noopener,noreferrer');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posts, selectedIndex]);

  const handleToggleRead = async (id: string, current: boolean) => {
    try {
      await apiRequest(`/api/posts/${id}/read`, {
        method: 'POST',
        body: JSON.stringify({ is_read: !current }),
      });
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, isRead: !current } : p)));
    } catch {}
  };

  const handleToggleBookmark = async (id: string, current: boolean) => {
    try {
      await apiRequest(`/api/posts/${id}/bookmark`, { method: 'POST' });
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, isBookmarked: !current } : p)));
    } catch {}
  };

  const handleHide = async (id: string) => {
    try {
      await apiRequest(`/api/posts/${id}/hide`, { method: 'POST' });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((c) => Math.max(c - 1, 0));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/posts/mark-all-read', {
        method: 'POST',
        body: JSON.stringify({
          sourceId: selectedSourceId || undefined,
          groupId: selectedGroupId || undefined,
        }),
      });
      setPosts((prev) => prev.map((p) => ({ ...p, isRead: true })));
    } catch {}
  };

  // Grouped clustered posts
  const clusteredGroups = React.useMemo(() => {
    if (!clusterViewMode) return [];
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const key = p.clusterTitle || t('Uncategorized Posts', 'بدون کلاستر (پست‌های متفرقه)');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).map(([title, clusterPosts]) => ({ title, clusterPosts }));
  }, [posts, clusterViewMode, t]);

  return (
    <div className="space-y-4">
      {/* Real-time New Posts Banner */}
      {pendingNewPostsCount > 0 && (
        <div className="sticky top-20 z-20 flex justify-center">
          <button
            onClick={handleLoadNewPosts}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUp className="w-4 h-4" />
            <span>
              {t(
                `${pendingNewPostsCount} new posts available — Load at top`,
                `${toPersianDigits(pendingNewPostsCount)} پست جدید در دسترس است — بارگذاری در بالا`
              )}
            </span>
          </button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        {/* Left Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium me-1">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>{t('Filters:', 'فیلترها:')}</span>
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">{t('All Groups', 'همه گروه‌ها')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">{t('All Sources', 'همه منابع')}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name || s.value}
              </option>
            ))}
          </select>

          {/* Unread Only Toggle */}
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              unreadOnly
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{t('Unread Only', 'فقط خوانده‌نشده')}</span>
          </button>

          {/* Bookmarked Only */}
          <button
            onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              bookmarkedOnly
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{t('Saved', 'نشان‌شده‌ها')}</span>
          </button>

          {/* Media Only */}
          <button
            onClick={() => setHasMediaOnly(!hasMediaOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              hasMediaOnly
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{t('With Media', 'رسانه‌دار')}</span>
          </button>

          {/* Min Importance */}
          <select
            value={minImportance}
            onChange={(e) => setMinImportance(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="0">{t('Importance: All', 'اهمیت: همه')}</option>
            <option value="6">{t('Importance ≥ 6', 'اهمیت ≥ ۶')}</option>
            <option value="8">{t('Importance ≥ 8 (Critical)', 'اهمیت ≥ ۸ (فوری)')}</option>
          </select>
        </div>

        {/* Right Tools & Exports */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Clustered View Toggle */}
          <button
            onClick={() => setClusterViewMode(!clusterViewMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              clusterViewMode
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={t('Group related event posts from the last 24h', 'دسته‌بندی پست‌های رویدادهای مشترک ۲۴ ساعت اخیر')}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('Cluster View', 'نمای کلاستر')}</span>
          </button>

          {/* Mark all as read */}
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors flex items-center gap-1.5"
            title={t('Mark current filtered posts as read', 'علامت‌گذاری فیلتر جاری به عنوان خوانده‌شده')}
          >
            <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('Mark All Read', 'خواندن همه')}</span>
          </button>

          {/* Export Links */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden text-xs">
            <a
              href="/api/posts/export?format=csv"
              download
              className="px-2.5 py-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors flex items-center gap-1 border-e border-slate-800"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </a>
            <a
              href="/api/posts/export?format=json"
              download
              className="px-2.5 py-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <span>JSON</span>
            </a>
          </div>
        </div>
      </div>

      {/* Feed List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-32 h-3.5 bg-slate-800 rounded" />
                  <div className="w-20 h-2.5 bg-slate-800 rounded" />
                </div>
              </div>
              <div className="w-full h-12 bg-slate-800/60 rounded-xl" />
              <div className="w-24 h-4 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
            <SearchX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200">
            {t('No posts match the selected filters', 'هیچ پستی با فیلترهای انتخابی یافت نشد')}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t(
              'Try resetting your filters or add new accounts and hashtags in Monitored Sources.',
              'می‌توانید فیلترها را بازنشانی کنید یا در بخش «منابع پایش» منابع جدیدی اضافه فرمایید.'
            )}
          </p>
        </div>
      ) : clusterViewMode ? (
        // Clustered View
        <div className="space-y-6">
          {clusteredGroups.map((group, gIdx) => (
            <div key={gIdx} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-sm text-slate-200">{group.title}</h4>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {toPersianDigits(group.clusterPosts.length)} {t('posts', 'پست')}
                </span>
              </div>
              <div className="space-y-3">
                {group.clusterPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onToggleRead={handleToggleRead}
                    onToggleBookmark={handleToggleBookmark}
                    onHide={handleHide}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Standard Feed List
        <div className="space-y-3.5">
          {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              isSelected={index === selectedIndex}
              onToggleRead={handleToggleRead}
              onToggleBookmark={handleToggleBookmark}
              onHide={handleHide}
            />
          ))}
        </div>
      )}

      {/* Keyboard navigation helper */}
      <div className="text-center pt-4 pb-2 text-[11px] text-slate-500">
        {t('Keyboard Shortcuts:', 'راهنمای کیبورد:')}{' '}
        <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono">j</kbd>/
        <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono">k</kbd> {t('Next/Prev', 'بعدی/قبلی')} •{' '}
        <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono">m</kbd> {t('Read/Unread', 'خوانده‌شده')} •{' '}
        <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono">b</kbd> {t('Save', 'نشان')} •{' '}
        <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono">o</kbd> {t('Open on X', 'باز کردن در X')}
      </div>
    </div>
  );
};

