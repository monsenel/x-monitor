import { db } from './index.ts';

export function seedInitialDataIfNeeded() {
  const sourcesCount = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as any)?.count || 0;
  if (sourcesCount > 0) return;

  const now = new Date();

  // Create groups
  const techGroupId = 'grp-tech';
  const newsGroupId = 'grp-news';

  db.prepare(`
    INSERT OR IGNORE INTO groups (id, name, color, default_interval_minutes, created_at)
    VALUES 
      (?, 'فناوری و هوش مصنوعی', '#06b6d4', 30, ?),
      (?, 'اخبار و رسانه', '#f59e0b', 20, ?)
  `).run(techGroupId, now.toISOString(), newsGroupId, now.toISOString());

  // Create default sources
  const s1 = 'src-seed-1';
  const s2 = 'src-seed-2';
  const s3 = 'src-seed-3';
  const s4 = 'src-seed-4';

  const insertSource = db.prepare(`
    INSERT INTO sources (
      id, type, value, display_name, group_id, color, priority, enabled,
      poll_interval_min, interval_minutes, provider, max_results, next_poll_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSource.run(s1, 'account', 'sama', 'Sam Altman', techGroupId, '#38bdf8', 5, 1, 30, 30, 'twscrape', 20, new Date(now.getTime() + 600000).toISOString(), now.toISOString());
  insertSource.run(s2, 'account', 'elonmusk', 'Elon Musk', techGroupId, '#a855f7', 4, 1, 30, 30, 'twscrape', 20, new Date(now.getTime() + 900000).toISOString(), now.toISOString());
  insertSource.run(s3, 'hashtag', 'هوش_مصنوعی', '#هوش_مصنوعی', techGroupId, '#10b981', 4, 1, 45, 45, 'twscrape', 15, new Date(now.getTime() + 1200000).toISOString(), now.toISOString());
  insertSource.run(s4, 'keyword', 'استارتاپ', 'کلیدواژه استارتاپ', newsGroupId, '#f43f5e', 3, 1, 60, 60, 'nitter-rss', 15, new Date(now.getTime() + 1500000).toISOString(), now.toISOString());

  // Insert initial seed posts with AI enrichments already filled for immediate rich UI
  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO posts (
      x_post_id, author_id, author_username, author_name, author_avatar,
      text, lang, created_at, metrics_json, media_json, url, fetched_at,
      is_read, is_bookmarked, importance, importance_reason, sentiment, topics_json,
      translation_fa, ai_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const linkPost = db.prepare(`
    INSERT OR IGNORE INTO post_sources (post_id, source_id, matched_at)
    VALUES (?, ?, ?)
  `);

  const p1 = '184719283746192801';
  insertPost.run(
    p1,
    '44196397',
    'sama',
    'Sam Altman',
    'https://pbs.twimg.com/profile_images/808388417537150976/b00zT34c_normal.jpg',
    'planning to release new reasoning capabilities next week. super excited about what people will build with this.',
    'en',
    new Date(now.getTime() - 45 * 60000).toISOString(),
    JSON.stringify({ likes: 24500, retweets: 3820, replies: 1204, quotes: 840, views: 1850000 }),
    JSON.stringify([]),
    'https://x.com/sama/status/184719283746192801',
    now.toISOString(),
    0, // unread
    1, // bookmarked
    9,
    'اعلام عرضه قریب‌الوقوع مدل‌های استدلال جدید OpenAI با تاثیر مستقیم بر اکوسیستم هوش مصنوعی.',
    'positive',
    JSON.stringify(['هوش مصنوعی', 'OpenAI', 'فناوری']),
    'برنامه‌ریزی برای انتشار قابلیت‌های استدلالی جدید در هفته آینده. بسیار هیجان‌زده‌ام برای آنچه مردم با این ابزار خواهند ساخت.',
    'done'
  );
  linkPost.run(p1, s1, now.toISOString());

  const p2 = '184719283746192802';
  insertPost.run(
    p2,
    '44196397',
    'elonmusk',
    'Elon Musk',
    'https://pbs.twimg.com/profile_images/1780044485541699584/p78MCnIo_normal.jpg',
    'Grok 3 is trained on a massive 100k H100 cluster in Memphis. It is something truly special.',
    'en',
    new Date(now.getTime() - 110 * 60000).toISOString(),
    JSON.stringify({ likes: 58200, retweets: 9140, replies: 4320, quotes: 1100, views: 4200000 }),
    JSON.stringify([]),
    'https://x.com/elonmusk/status/184719283746192802',
    now.toISOString(),
    0,
    0,
    8,
    'گزارش پیشرفت کلاستر عظیم محاسباتی xAI و آماده‌سازی مدل جدید Grok 3.',
    'positive',
    JSON.stringify(['xAI', 'Grok', 'سخت‌افزار']),
    'گروک ۳ بر روی کلاستر عظیم ۱۰۰ هزار پردازنده H100 در ممفیس آموزش دیده است. واقعاً چیز بسیار ویژه‌ای است.',
    'done'
  );
  linkPost.run(p2, s2, now.toISOString());

  const p3 = '184719283746192803';
  insertPost.run(
    p3,
    '10293847',
    'tech_fa_hub',
    'مرکز فناوری ایران',
    null,
    'گزارش جدید از توسعه استارتاپ‌های بومی در حوزه #هوش_مصنوعی نشان‌دهنده رشد ۳۵ درصدی جذب سرمایه در ۶ ماه اخیر است.',
    'fa',
    new Date(now.getTime() - 180 * 60000).toISOString(),
    JSON.stringify({ likes: 312, retweets: 48, replies: 19 }),
    JSON.stringify([]),
    'https://x.com/tech_fa_hub/status/184719283746192803',
    now.toISOString(),
    1, // read
    0,
    7,
    'گزارش آماری رشد سرمایه‌گذاری در اکوسیستم هوش مصنوعی ایران.',
    'positive',
    JSON.stringify(['هوش مصنوعی', 'سرمایه‌گذاری', 'استارتاپ']),
    null,
    'done'
  );
  linkPost.run(p3, s3, now.toISOString());

  // Seed usage log
  db.prepare(`
    INSERT INTO usage_log (ts, provider, endpoint, source_id, posts_read, users_read, calls, est_cost_usd)
    VALUES 
      (?, 'twscrape', '/user-tweets', ?, 20, 1, 1, 0),
      (?, 'twscrape', '/search', ?, 15, 0, 1, 0),
      (?, 'x-official', '/2/users/:id/tweets', ?, 10, 1, 1, 0.05)
  `).run(
    new Date(now.getTime() - 3600000).toISOString(), s1,
    new Date(now.getTime() - 7200000).toISOString(), s3,
    new Date(now.getTime() - 10800000).toISOString(), s2
  );

  // Seed FTS
  try {
    db.prepare(`
      INSERT OR IGNORE INTO posts_fts (post_id, author_username, author_name, text, translation_fa)
      VALUES 
        (?, 'sama', 'Sam Altman', 'planning to release new reasoning capabilities next week...', 'برنامه‌ریزی برای انتشار قابلیت‌های استدلالی جدید...'),
        (?, 'elonmusk', 'Elon Musk', 'Grok 3 is trained on a massive 100k H100 cluster...', 'گروک ۳ بر روی کلاستر عظیم ۱۰۰ هزار پردازنده...'),
        (?, 'tech_fa_hub', 'مرکز فناوری ایران', 'گزارش جدید از توسعه استارتاپ‌های بومی...', '')
    `).run(p1, p2, p3);
  } catch {}

  console.log('[Seed] Initial demonstration sources and posts populated successfully.');
}
