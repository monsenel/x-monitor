import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'xmonitor.db');

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for durability and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

export function initDatabase() {
  // 1. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Groups Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#06b6d4',
      default_interval_minutes INTEGER DEFAULT 30,
      active_hours_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 3. Sources Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'account' | 'hashtag' | 'keyword' | 'query'
      value TEXT NOT NULL,
      interval_minutes INTEGER, -- nullable = inherit
      cron_expr TEXT,
      active_hours_json TEXT,
      off_hours_mode TEXT DEFAULT 'pause', -- 'pause' | 'slow'
      off_hours_interval_minutes INTEGER DEFAULT 180,
      provider TEXT, -- nullable = global default ('twscrape' | 'nitter-rss' | 'x-official' | 'twitterapi-io')
      provider_state_json TEXT,
      use_timeline_fallback INTEGER DEFAULT 0,
      x_user_id TEXT,
      display_name TEXT,
      avatar_url TEXT,
      group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
      color TEXT DEFAULT '#38bdf8',
      priority INTEGER DEFAULT 3,
      enabled INTEGER DEFAULT 1,
      poll_interval_min INTEGER DEFAULT 30,
      max_results INTEGER DEFAULT 20,
      daily_cap INTEGER DEFAULT 100,
      exclude_retweets INTEGER DEFAULT 0,
      exclude_replies INTEGER DEFAULT 0,
      lang TEXT,
      ai_enabled INTEGER DEFAULT 1,
      since_id TEXT,
      last_polled_at TEXT,
      next_poll_at TEXT,
      consecutive_failures INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sources_next_poll ON sources(enabled, next_poll_at);
    CREATE INDEX IF NOT EXISTS idx_sources_type_value ON sources(type, value);
  `);

  // 4. Clusters Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clusters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL,
      post_count INTEGER DEFAULT 1
    );
  `);

  // 5. Posts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      x_post_id TEXT PRIMARY KEY,
      author_id TEXT,
      author_username TEXT NOT NULL,
      author_name TEXT,
      author_avatar TEXT,
      text TEXT NOT NULL,
      lang TEXT,
      created_at TEXT NOT NULL,
      metrics_json TEXT, -- { likes, retweets, replies, quotes, views }
      media_json TEXT,   -- [{ type, url, previewUrl }]
      url TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      is_bookmarked INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      importance INTEGER,
      importance_reason TEXT,
      sentiment TEXT, -- 'positive' | 'neutral' | 'negative'
      topics_json TEXT, -- string[]
      translation_fa TEXT,
      cluster_id TEXT REFERENCES clusters(id) ON DELETE SET NULL,
      ai_status TEXT DEFAULT 'pending' -- 'pending' | 'done' | 'failed' | 'disabled'
    );
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_read_bookmark ON posts(is_read, is_bookmarked, is_hidden);
    CREATE INDEX IF NOT EXISTS idx_posts_ai_status ON posts(ai_status);
  `);

  // 6. Post-Sources Many-to-Many Linking Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_sources (
      post_id TEXT NOT NULL REFERENCES posts(x_post_id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      matched_at TEXT NOT NULL,
      PRIMARY KEY (post_id, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_post_sources_source ON post_sources(source_id);
  `);

  // 7. FTS5 Virtual Table for Instant Search
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
        post_id UNINDEXED,
        author_username,
        author_name,
        text,
        translation_fa,
        tokenize = 'unicode61'
      );
    `);
  } catch (err) {
    console.warn('FTS5 table init note:', err);
  }

  // 8. Usage Log Table (API calls & costs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      source_id TEXT,
      posts_read INTEGER DEFAULT 0,
      users_read INTEGER DEFAULT 0,
      calls INTEGER DEFAULT 1,
      est_cost_usd REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_usage_log_ts ON usage_log(ts);
    CREATE INDEX IF NOT EXISTS idx_usage_log_provider ON usage_log(provider);
  `);

  // 9. AI Usage Log Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      operation TEXT NOT NULL, -- 'enrichment' | 'cluster' | 'digest'
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      est_cost_usd REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_ts ON ai_usage_log(ts);
  `);

  // 10. Rate Limits Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      remaining INTEGER,
      reset_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (provider, endpoint)
    );
  `);

  // 11. Digests Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS digests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      content TEXT NOT NULL,
      top_posts_json TEXT,
      group_summaries_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 12. Alert Rules and Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      source_id TEXT,
      keyword TEXT,
      min_importance INTEGER,
      min_likes INTEGER,
      channel_telegram INTEGER DEFAULT 0,
      channel_inapp INTEGER DEFAULT 1,
      channel_push INTEGER DEFAULT 0,
      cooldown_minutes INTEGER DEFAULT 30,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id TEXT,
      post_id TEXT,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL, -- 'sent' | 'failed'
      error TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 13. Sessions & Login Lockouts
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      last_attempt TEXT NOT NULL
    );
  `);

  initDefaultSettings();
}

function initDefaultSettings() {
  const defaults: Record<string, string> = {
    default_provider: 'twscrape',
    global_polling_paused: '0',
    global_poll_interval_minutes: '30',
    global_jitter_percent: '20',
    timezone: 'Asia/Tehran',
    theme: 'dark',
    retention_days: '30',
    auto_nitter_fallback: '1',

    // Prices
    'price_x_official_tweet_read': '0.005',
    'price_twitterapi_io_tweet_read': '0.00015', // $0.15 per 1,000 tweets
    'price_twitterapi_io_user_read': '0.00018',  // $0.18 per 1,000 users
    'price_twitterapi_io_min_call': '0.0',

    // Budgets
    budget_x_official_monthly: '10.0',
    budget_x_official_warning_percent: '80',
    budget_twitterapi_io_monthly: '5.0',
    budget_twitterapi_io_warning_percent: '80',
    budget_total_monthly: '15.0',
    budget_total_warning_percent: '80',
    budget_switch_on_kill: '0',

    // Provider Floors (in minutes)
    floor_twscrape_account: '15',
    floor_twscrape_search: '30',
    floor_nitter_rss: '10',
    floor_x_official: '15',
    floor_twitterapi_io: '5',

    // AI Settings
    ai_enrichment_enabled: '1',
    ai_provider: 'gemini', // 'gemini' | 'openai' | 'openrouter'
    ai_model: 'gemini-3.8-flash',
    ai_batch_size: '5',
    ai_openai_base_url: 'https://api.openai.com/v1',
    ai_openai_api_key: '',
    ai_openai_model: 'gpt-4o-mini',
    ai_openrouter_api_key: '',
    ai_openrouter_model: 'openai/gpt-4o-mini',

    // Nitter instances (one URL per line)
    nitter_instances: [
      'https://nitter.jaydenha.uk',
      'https://nitter.tiekoetter.com',
      'https://nitter.space',
      'https://nitter.privacydev.net'
    ].join('\n'),

    // Digest Schedule
    digest_schedule_type: 'daily', // 'off' | 'hourly' | 'daily'
    digest_daily_time: '20:00',
    last_digest_run: ''
  };

  const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');

  for (const [key, val] of Object.entries(defaults)) {
    const existing = getStmt.get(key);
    if (!existing) {
      insertStmt.run(key, val, new Date().toISOString());
    }
  }
}
