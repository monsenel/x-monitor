import { Router } from 'express';
import { db } from '../db/index.ts';
import { enrichPostsBatch } from '../ai/gemini.ts';

export const postsRouter = Router();

// Unified feed with filters, pagination, and FTS5 search
postsRouter.get('/', (req, res) => {
  const {
    sourceId,
    groupId,
    type,
    unreadOnly,
    bookmarked,
    minImportance,
    hasMedia,
    lang,
    search,
    limit = '30',
    offset = '0',
    clusterView,
  } = req.query as Record<string, string>;

  const conditions: string[] = ['p.is_hidden = 0'];
  const params: any[] = [];

  // FTS5 Search
  if (search && search.trim().length > 0) {
    const cleanSearch = search.trim().replace(/['"]/g, '');
    conditions.push(`p.x_post_id IN (
      SELECT post_id FROM posts_fts WHERE posts_fts MATCH ?
    )`);
    params.push(cleanSearch);
  }

  if (sourceId) {
    conditions.push('ps.source_id = ?');
    params.push(sourceId);
  }

  if (groupId) {
    conditions.push('s.group_id = ?');
    params.push(groupId);
  }

  if (type) {
    conditions.push('s.type = ?');
    params.push(type);
  }

  if (unreadOnly === 'true' || unreadOnly === '1') {
    conditions.push('p.is_read = 0');
  }

  if (bookmarked === 'true' || bookmarked === '1') {
    conditions.push('p.is_bookmarked = 1');
  }

  if (minImportance) {
    conditions.push('p.importance >= ?');
    params.push(parseInt(minImportance, 10));
  }

  if (hasMedia === 'true' || hasMedia === '1') {
    conditions.push("p.media_json != '[]' AND p.media_json IS NOT NULL");
  }

  if (lang) {
    conditions.push('p.lang = ?');
    params.push(lang);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `
    SELECT COUNT(DISTINCT p.x_post_id) as total
    FROM posts p
    LEFT JOIN post_sources ps ON p.x_post_id = ps.post_id
    LEFT JOIN sources s ON ps.source_id = s.id
    ${whereClause}
  `;
  const countRow = db.prepare(countSql).get(...params) as any;
  const total = countRow?.total || 0;

  // Query posts with sources list
  const sql = `
    SELECT 
      p.*,
      GROUP_CONCAT(json_object('id', s.id, 'value', s.value, 'type', s.type, 'color', s.color)) as sources_json,
      c.title as cluster_title
    FROM posts p
    LEFT JOIN post_sources ps ON p.x_post_id = ps.post_id
    LEFT JOIN sources s ON ps.source_id = s.id
    LEFT JOIN clusters c ON p.cluster_id = c.id
    ${whereClause}
    GROUP BY p.x_post_id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10), 1), 100);
  const parsedOffset = Math.max(parseInt(offset, 10), 0);

  const rows = db.prepare(sql).all(...params, parsedLimit, parsedOffset) as any[];

  const posts = rows.map((r) => {
    let sources: any[] = [];
    if (r.sources_json) {
      try {
        // SQLite GROUP_CONCAT joins JSON strings with commas; wrap in brackets to parse
        sources = JSON.parse(`[${r.sources_json}]`);
      } catch {}
    }

    return {
      id: r.x_post_id,
      authorId: r.author_id,
      authorUsername: r.author_username,
      authorName: r.author_name,
      authorAvatar: r.author_avatar,
      text: r.text,
      lang: r.lang,
      createdAt: r.created_at,
      metrics: r.metrics_json ? JSON.parse(r.metrics_json) : { likes: 0, retweets: 0, replies: 0 },
      media: r.media_json ? JSON.parse(r.media_json) : [],
      url: r.url,
      isRead: !!r.is_read,
      isBookmarked: !!r.is_bookmarked,
      digestedAt: r.digested_at || undefined,
      importance: r.importance,
      importanceReason: r.importance_reason,
      sentiment: r.sentiment,
      topics: r.topics_json ? JSON.parse(r.topics_json) : [],
      translationFa: r.translation_fa,
      clusterId: r.cluster_id,
      clusterTitle: r.cluster_title,
      aiStatus: r.ai_status,
      sources,
    };
  });

  res.json({
    posts,
    total,
    limit: parsedLimit,
    offset: parsedOffset,
    hasMore: parsedOffset + posts.length < total,
  });
});

// Unread counts summary
postsRouter.get('/unread-counts', (_req, res) => {
  const row = db.prepare('SELECT COUNT(*) as unread FROM posts WHERE is_read = 0 AND is_hidden = 0').get() as any;
  const bookmarkedRow = db.prepare('SELECT COUNT(*) as bookmarked FROM posts WHERE is_bookmarked = 1').get() as any;
  res.json({
    unread: row?.unread || 0,
    bookmarked: bookmarkedRow?.bookmarked || 0,
  });
});

// Toggle read
postsRouter.post('/:id/read', (req, res) => {
  const { id } = req.params;
  const { is_read } = req.body;
  const val = is_read !== undefined ? (is_read ? 1 : 0) : 1;
  db.prepare('UPDATE posts SET is_read = ? WHERE x_post_id = ?').run(val, id);
  res.json({ ok: true, is_read: val });
});

// Toggle bookmark
postsRouter.post('/:id/bookmark', (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT is_bookmarked FROM posts WHERE x_post_id = ?').get(id) as any;
  if (!current) return res.status(404).json({ error: 'پست یافت نشد.' });

  const newVal = current.is_bookmarked ? 0 : 1;
  db.prepare('UPDATE posts SET is_bookmarked = ? WHERE x_post_id = ?').run(newVal, id);
  res.json({ ok: true, is_bookmarked: newVal });
});

// Toggle hide
postsRouter.post('/:id/hide', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE posts SET is_hidden = 1 WHERE x_post_id = ?').run(id);
  res.json({ ok: true });
});

// Mark all matching filter as read
postsRouter.post('/mark-all-read', (req, res) => {
  const { sourceId, groupId } = req.body;

  if (sourceId) {
    db.prepare(`
      UPDATE posts SET is_read = 1
      WHERE x_post_id IN (SELECT post_id FROM post_sources WHERE source_id = ?)
    `).run(sourceId);
  } else if (groupId) {
    db.prepare(`
      UPDATE posts SET is_read = 1
      WHERE x_post_id IN (
        SELECT ps.post_id FROM post_sources ps
        JOIN sources s ON ps.source_id = s.id
        WHERE s.group_id = ?
      )
    `).run(groupId);
  } else {
    db.prepare('UPDATE posts SET is_read = 1').run();
  }

  res.json({ ok: true, message: 'همه پست‌ها به عنوان خوانده‌شده علامت‌گذاری شدند.' });
});

// Retry AI enrichment
postsRouter.post('/:id/enrich', async (req, res) => {
  const { id } = req.params;
  const post = db.prepare('SELECT x_post_id as id, text, lang, author_username as author FROM posts WHERE x_post_id = ?').get(id) as any;
  if (!post) return res.status(404).json({ error: 'پست یافت نشد.' });

  const results = await enrichPostsBatch([post]);
  if (results.length > 0) {
    const r = results[0];
    db.prepare(`
      UPDATE posts SET
        importance = ?,
        importance_reason = ?,
        sentiment = ?,
        topics_json = ?,
        translation_fa = ?,
        ai_status = 'done'
      WHERE x_post_id = ?
    `).run(r.importance, r.importanceReason, r.sentiment, JSON.stringify(r.topics), r.translationFa || null, id);
    res.json({ ok: true, enrichment: r });
  } else {
    res.status(500).json({ error: 'خطا در ارزیابی هوش مصنوعی' });
  }
});

// Export to JSON or CSV
postsRouter.get('/export', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const rows = db.prepare(`
    SELECT p.*, s.value as source_value
    FROM posts p
    LEFT JOIN post_sources ps ON p.x_post_id = ps.post_id
    LEFT JOIN sources s ON ps.source_id = s.id
    WHERE p.is_hidden = 0
    ORDER BY p.created_at DESC
    LIMIT 1000
  `).all() as any[];

  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="xmonitor_export.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.json(rows);
  }

  // CSV format
  const headers = ['ID', 'Author', 'Text', 'Translation', 'Importance', 'Sentiment', 'Created_At', 'URL'];
  const csvLines = [headers.join(',')];

  for (const r of rows) {
    const cleanText = (r.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const cleanTrans = (r.translation_fa || '').replace(/"/g, '""').replace(/\n/g, ' ');
    csvLines.push([
      `"${r.x_post_id}"`,
      `"${r.author_username}"`,
      `"${cleanText}"`,
      `"${cleanTrans}"`,
      `"${r.importance || ''}"`,
      `"${r.sentiment || ''}"`,
      `"${r.created_at}"`,
      `"${r.url}"`,
    ].join(','));
  }

  res.setHeader('Content-Disposition', 'attachment; filename="xmonitor_export.csv"');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csvLines.join('\n')); // Include UTF-8 BOM for Excel Persian support
});
