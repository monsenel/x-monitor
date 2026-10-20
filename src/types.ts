export interface PostMedia {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  previewUrl?: string;
}

export interface PostMetrics {
  likes: number;
  retweets: number;
  replies: number;
  quotes?: number;
  views?: number;
}

export interface PostSourceTag {
  id: string;
  value: string;
  type: string;
  color?: string;
}

export interface Post {
  id: string;
  authorId?: string;
  authorUsername: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  lang?: string;
  createdAt: string;
  metrics: PostMetrics;
  media: PostMedia[];
  url: string;
  isRead: boolean;
  isBookmarked: boolean;
  importance?: number;
  importanceReason?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  topics?: string[];
  translationFa?: string;
  clusterId?: string;
  clusterTitle?: string;
  aiStatus: 'pending' | 'done' | 'failed' | 'disabled';
  sources: PostSourceTag[];
}

export interface Source {
  id: string;
  type: 'account' | 'hashtag' | 'keyword' | 'query';
  value: string;
  interval_minutes?: number | null;
  cron_expr?: string | null;
  active_hours_json?: string | null;
  off_hours_mode?: 'pause' | 'slow';
  off_hours_interval_minutes?: number;
  provider?: string | null;
  provider_state_json?: string | null;
  use_timeline_fallback?: number;
  x_user_id?: string | null;
  display_name?: string;
  avatar_url?: string;
  group_id?: string | null;
  group_name?: string;
  group_color?: string;
  color?: string;
  priority?: number;
  enabled?: number;
  max_results?: number;
  daily_cap?: number;
  exclude_retweets?: number;
  exclude_replies?: number;
  lang?: string;
  ai_enabled?: number;
  last_polled_at?: string;
  next_poll_at?: string;
  consecutive_failures?: number;
  last_error?: string;
  posts_today?: number;
  cost_today?: number;
  effective_interval_minutes: number;
  effective_interval_level: 'source' | 'group' | 'global';
  created_at: string;
}

export interface SourceGroup {
  id: string;
  name: string;
  color: string;
  default_interval_minutes: number;
  active_hours_json?: string;
}

export interface ProviderInfo {
  id: 'twscrape' | 'nitter-rss' | 'x-official' | 'twitterapi-io';
  name: string;
  isFree: boolean;
  requiresKey: boolean;
  configured: boolean;
  isDefault: boolean;
}

export interface DigestItem {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  content: string;
  top_posts: string[];
  group_summaries: Record<string, string>;
  created_at: string;
}

export interface AlertRuleItem {
  id: string;
  name: string;
  enabled: number;
  source_id?: string | null;
  keyword?: string | null;
  min_importance?: number | null;
  min_likes?: number | null;
  channel_telegram: number;
  channel_inapp: number;
  channel_push: number;
  cooldown_minutes: number;
  last_triggered_at?: string | null;
  created_at: string;
}

export interface AlertLogItem {
  id: number;
  rule_id: string;
  post_id?: string;
  channel: string;
  title: string;
  message: string;
  status: 'sent' | 'failed';
  error?: string;
  created_at: string;
}

export interface UsageSummary {
  monthTotalSpend: number;
  projectedMonthEnd: number;
  budgets: {
    total: number;
    'x-official': number;
    'twitterapi-io': number;
  };
  spendToday: any[];
  spendMonthByProvider: Record<string, { spend: number; posts: number; calls: number }>;
}
