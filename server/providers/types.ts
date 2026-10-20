export interface NormalizedUser {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
}

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

export interface NormalizedPost {
  id: string;
  authorId?: string;
  authorUsername: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  lang?: string;
  createdAt: string; // ISO 8601
  metrics: PostMetrics;
  media: PostMedia[];
  url: string;
  isReply: boolean;
  isRetweet: boolean;
  isQuote: boolean;
}

export interface ProviderUsage {
  postsRead: number;
  usersRead: number;
  calls: number;
  endpoint?: string;
}

export interface FetchResult {
  posts: NormalizedPost[];
  users: NormalizedUser[];
  newState: Record<string, unknown>;
  usage: ProviderUsage;
}

export interface SourceEntity {
  id: string;
  type: 'account' | 'hashtag' | 'keyword' | 'query';
  value: string;
  interval_minutes?: number | null;
  cron_expr?: string | null;
  active_hours_json?: string | null;
  off_hours_mode?: string | null;
  off_hours_interval_minutes?: number | null;
  provider?: string | null;
  provider_state_json?: string | null;
  use_timeline_fallback?: number | null;
  x_user_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  group_id?: string | null;
  color?: string | null;
  priority?: number | null;
  enabled?: number | null;
  poll_interval_min?: number | null;
  max_results?: number | null;
  daily_cap?: number | null;
  exclude_retweets?: number | null;
  exclude_replies?: number | null;
  lang?: string | null;
  ai_enabled?: number | null;
  since_id?: string | null;
  last_polled_at?: string | null;
  next_poll_at?: string | null;
  consecutive_failures?: number | null;
  last_error?: string | null;
  created_at: string;
}

export interface HealthCheckResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface DataProvider {
  id: 'twscrape' | 'nitter-rss' | 'x-official' | 'twitterapi-io';
  name: string;
  isFree: boolean;
  requiresKey: boolean;

  resolveAccount(username: string): Promise<NormalizedUser>;
  fetchNew(source: SourceEntity, state: Record<string, unknown>): Promise<FetchResult>;
  healthCheck(): Promise<HealthCheckResult>;
  estimateCost(usage: ProviderUsage): number;
}
