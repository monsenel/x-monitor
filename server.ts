import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

import { initDatabase, db } from './server/db/index.ts';
import { seedInitialDataIfNeeded } from './server/db/seed.ts';
import { requireAuth, requireCsrfHeader } from './server/security/auth.ts';
import { scheduler } from './server/scheduler/poller.ts';
import { sseManager } from './server/scheduler/sse.ts';

// Routes
import { authRouter } from './server/routes/auth.ts';
import { sourcesRouter } from './server/routes/sources.ts';
import { postsRouter } from './server/routes/posts.ts';
import { providersRouter } from './server/routes/providers.ts';
import { scraperRouter } from './server/routes/scraper.ts';
import { digestsRouter } from './server/routes/digests.ts';
import { alertsRouter } from './server/routes/alerts.ts';
import { usageRouter } from './server/routes/usage.ts';
import { settingsRouter } from './server/routes/settings.ts';
import { schedulerRouter } from './server/routes/scheduler.ts';

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize DB schema & default data
initDatabase();
seedInitialDataIfNeeded();

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Security Headers & strict CSP
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https://pbs.twimg.com https://abs.twimg.com blob:",
      "connect-src 'self' ws: wss:",
    ].join('; ')
  );
  next();
});

// SSE endpoint for real-time updates
app.get('/api/events', requireAuth, (req, res) => {
  const clientId = crypto.randomUUID();
  sseManager.addClient(clientId, res);
  req.on('close', () => {
    sseManager.removeClient(clientId);
  });
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth Routes (unauthenticated routes inside router)
app.use('/api/auth', authRouter);

// Protected API routes with CSRF verification
app.use('/api/sources', requireAuth, requireCsrfHeader, sourcesRouter);
app.use('/api/posts', requireAuth, requireCsrfHeader, postsRouter);
app.use('/api/providers', requireAuth, requireCsrfHeader, providersRouter);
app.use('/api/scraper', requireAuth, requireCsrfHeader, scraperRouter);
app.use('/api/digests', requireAuth, requireCsrfHeader, digestsRouter);
app.use('/api/alerts', requireAuth, requireCsrfHeader, alertsRouter);
app.use('/api/usage', requireAuth, requireCsrfHeader, usageRouter);
app.use('/api/settings', requireAuth, requireCsrfHeader, settingsRouter);
app.use('/api/scheduler', requireAuth, requireCsrfHeader, schedulerRouter);

// Start scheduler
scheduler.start();

// Vite dev middleware or static serving
async function setupFrontend() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[X Monitor] Server running at http://0.0.0.0:${PORT}`);
  });
}

setupFrontend().catch((err) => {
  console.error('[X Monitor] Failed to start server:', err);
  process.exit(1);
});
