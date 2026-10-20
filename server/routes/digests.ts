import { Router } from 'express';
import { db } from '../db/index.ts';
import { scheduler } from '../scheduler/poller.ts';
import { clusterRecentPosts } from '../ai/gemini.ts';

export const digestsRouter = Router();

// List digests
digestsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM digests ORDER BY created_at DESC LIMIT 50').all() as any[];
  const formatted = rows.map((r) => ({
    ...r,
    top_posts: r.top_posts_json ? JSON.parse(r.top_posts_json) : [],
    group_summaries: r.group_summaries_json ? JSON.parse(r.group_summaries_json) : {},
  }));
  res.json(formatted);
});

// Trigger on-demand digest
digestsRouter.post('/generate', async (_req, res) => {
  try {
    const result = await scheduler.runDigest();
    res.json({ ok: true, digest: result });
  } catch (err: any) {
    res.status(500).json({ error: `خطا در تولید خلاصه: ${err.message}` });
  }
});

// Trigger clustering
digestsRouter.post('/cluster-now', async (_req, res) => {
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recentPosts = db.prepare(`
    SELECT x_post_id as id, text, author_username as author
    FROM posts
    WHERE created_at >= ? AND is_hidden = 0
    ORDER BY created_at DESC
    LIMIT 40
  `).all(oneDayAgo) as unknown as { id: string; text: string; author: string }[];

  const clusters = await clusterRecentPosts(recentPosts);
  let createdCount = 0;

  for (const c of clusters) {
    if (c.postIds && c.postIds.length >= 2) {
      const clusterId = `cluster-${Date.now()}-${createdCount}`;
      db.prepare(`
        INSERT INTO clusters (id, title, summary, created_at, post_count)
        VALUES (?, ?, ?, ?, ?)
      `).run(clusterId, c.title, c.summary || null, new Date().toISOString(), c.postIds.length);

      const updatePost = db.prepare('UPDATE posts SET cluster_id = ? WHERE x_post_id = ?');
      for (const pid of c.postIds) {
        updatePost.run(clusterId, pid);
      }
      createdCount++;
    }
  }

  res.json({ ok: true, createdCount, clusters });
});

// Get clusters
digestsRouter.get('/clusters', (_req, res) => {
  const clusters = db.prepare(`
    SELECT c.*, COUNT(p.x_post_id) as actual_post_count
    FROM clusters c
    LEFT JOIN posts p ON c.id = p.cluster_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT 30
  `).all();
  res.json(clusters);
});
