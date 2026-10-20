import { Router } from 'express';
import { db } from '../db/index.ts';

export const usageRouter = Router();

usageRouter.get('/', (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  // Spend today
  const spendTodayRows = db.prepare(`
    SELECT provider, SUM(est_cost_usd) as spend, SUM(posts_read) as posts, SUM(calls) as calls
    FROM usage_log
    WHERE ts >= ?
    GROUP BY provider
  `).all(todayStart) as any[];

  // Spend this month
  const spendMonthRows = db.prepare(`
    SELECT provider, SUM(est_cost_usd) as spend, SUM(posts_read) as posts, SUM(calls) as calls
    FROM usage_log
    WHERE ts >= ?
    GROUP BY provider
  `).all(monthStart) as any[];

  let monthTotalSpend = 0;
  const monthSpendByProvider: Record<string, { spend: number; posts: number; calls: number }> = {
    'twscrape': { spend: 0, posts: 0, calls: 0 },
    'nitter-rss': { spend: 0, posts: 0, calls: 0 },
    'x-official': { spend: 0, posts: 0, calls: 0 },
    'twitterapi-io': { spend: 0, posts: 0, calls: 0 },
  };

  for (const r of spendMonthRows) {
    monthTotalSpend += r.spend || 0;
    monthSpendByProvider[r.provider] = {
      spend: Number((r.spend || 0).toFixed(4)),
      posts: r.posts || 0,
      calls: r.calls || 0,
    };
  }

  // Projected month-end cost
  const projectedMonthEnd = currentDay > 0 ? (monthTotalSpend / currentDay) * daysInMonth : 0;

  // Daily trend line (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
  const dailyTrends = db.prepare(`
    SELECT 
      substr(ts, 1, 10) as day,
      provider,
      SUM(est_cost_usd) as spend,
      SUM(posts_read) as posts
    FROM usage_log
    WHERE ts >= ?
    GROUP BY substr(ts, 1, 10), provider
    ORDER BY day ASC
  `).all(fourteenDaysAgo);

  // Per-source breakdown & noisiest sources
  const perSource = db.prepare(`
    SELECT 
      s.id,
      s.value,
      s.type,
      s.provider,
      COALESCE(SUM(u.posts_read), 0) as total_posts,
      COALESCE(SUM(u.calls), 0) as total_calls,
      COALESCE(SUM(u.est_cost_usd), 0) as total_cost
    FROM sources s
    LEFT JOIN usage_log u ON s.id = u.source_id AND u.ts >= ?
    GROUP BY s.id
    ORDER BY total_cost DESC, total_posts DESC
  `).all(monthStart) as any[];

  // AI usage summary
  const aiUsage = db.prepare(`
    SELECT 
      operation,
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(est_cost_usd) as total_cost
    FROM ai_usage_log
    WHERE ts >= ?
    GROUP BY operation
  `).all(monthStart);

  // Rate limits
  const rateLimits = db.prepare('SELECT * FROM rate_limits').all();

  // Budgets
  const bX = parseFloat((db.prepare("SELECT value FROM settings WHERE key = 'budget_x_official_monthly'").get() as any)?.value || '10');
  const bTw = parseFloat((db.prepare("SELECT value FROM settings WHERE key = 'budget_twitterapi_io_monthly'").get() as any)?.value || '5');
  const bTot = parseFloat((db.prepare("SELECT value FROM settings WHERE key = 'budget_total_monthly'").get() as any)?.value || '15');

  res.json({
    summary: {
      monthTotalSpend: Number(monthTotalSpend.toFixed(3)),
      projectedMonthEnd: Number(projectedMonthEnd.toFixed(3)),
      budgets: {
        total: bTot,
        'x-official': bX,
        'twitterapi-io': bTw,
      },
      spendToday: spendTodayRows,
      spendMonthByProvider: monthSpendByProvider,
    },
    dailyTrends,
    perSource,
    aiUsage,
    rateLimits,
  });
});
