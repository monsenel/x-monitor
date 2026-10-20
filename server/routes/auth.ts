import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { checkLoginLockout, recordLoginAttempt, signSession, unsignSession, verifyPassword } from '../security/auth.ts';
import { db } from '../db/index.ts';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post('/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const lockout = checkLoginLockout(ip);
  if (lockout.locked) {
    return res.status(429).json({
      error: `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${lockout.waitMinutes} دقیقه دیگر تلاش کنید.`,
    });
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
  }

  const { username, password } = parsed.data;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const storedHash = process.env.ADMIN_PASSWORD_HASH;

  if (username !== adminUser || !verifyPassword(password, storedHash)) {
    recordLoginAttempt(ip, false);
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  }

  recordLoginAttempt(ip, true);

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, ip, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, username, ip, req.headers['user-agent'] || '', new Date().toISOString(), expiresAt);

  const signedCookie = signSession(sessionId);

  res.cookie('xmonitor_session', signedCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 86400 * 1000,
    path: '/',
  });

  res.json({
    ok: true,
    user: { username },
    token: signedCookie,
  });
});

authRouter.get('/status', (req, res) => {
  const rawToken = (req.cookies?.['xmonitor_session'] as string | undefined) ||
                   req.headers['authorization']?.replace(/^Bearer\s+/, '') ||
                   (req.query?.token as string | undefined);

  if (rawToken) {
    const sessionId = unsignSession(rawToken) || (rawToken.includes('.') ? rawToken.split('.')[0] : rawToken);
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionId) as any;

    if (session && new Date(session.expires_at) >= new Date()) {
      return res.json({
        authenticated: true,
        user: { username: session.user_id },
        token: rawToken,
      });
    }
  }

  // If no custom password hash is configured (default single-user setup in AI Studio / container):
  // automatically create a valid session for seamless preview & iframe operation
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedHash) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    db.prepare(`
      INSERT INTO sessions (id, user_id, ip, user_agent, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, adminUser, ip, req.headers['user-agent'] || '', new Date().toISOString(), expiresAt);

    const signedCookie = signSession(sessionId);
    res.cookie('xmonitor_session', signedCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 86400 * 1000,
      path: '/',
    });

    return res.json({
      authenticated: true,
      user: { username: adminUser },
      token: signedCookie,
    });
  }

  res.json({
    authenticated: false,
  });
});

authRouter.post('/logout', (req, res) => {
  const rawToken = (req.cookies?.['xmonitor_session'] as string | undefined) ||
                   req.headers['authorization']?.replace(/^Bearer\s+/, '');
  if (rawToken) {
    const sessionId = unsignSession(rawToken) || (rawToken.includes('.') ? rawToken.split('.')[0] : rawToken);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
  res.clearCookie('xmonitor_session', { path: '/' });
  res.json({ ok: true });
});
