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

  // Create default sources (starter list; real posts come from polling)
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

  console.log('[Seed] Default groups and sources created (no demo posts).');
}
