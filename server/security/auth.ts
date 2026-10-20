import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || 'xmonitor-session-secret-change-me-32chars!';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Hash password with scrypt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) {
    // If no ADMIN_PASSWORD_HASH env provided, accept default 'admin123456' for ease of first setup
    return password === 'admin123456';
  }

  const parts = storedHash.split(':');
  if (parts.length === 3 && parts[0] === 'scrypt') {
    const salt = parts[1];
    const hash = parts[2];
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
  }

  // Fallback direct string compare if plain text was provided in env
  return password === storedHash;
}

// Sign session ID
export function signSession(sessionId: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  const signature = hmac.digest('hex');
  return `${sessionId}.${signature}`;
}

// Verify signed session ID
export function unsignSession(signedCookie: string): string | null {
  if (!signedCookie) return null;
  const parts = signedCookie.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, signature] = parts;
  try {
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(sessionId);
    const expected = hmac.digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (crypto.timingSafeEqual(sigBuf, expBuf)) {
      return sessionId;
    }
  } catch {
    return null;
  }
  return null;
}

// Check login attempts & lockout
export function checkLoginLockout(ip: string): { locked: boolean; waitMinutes?: number } {
  const row = db.prepare('SELECT attempts, locked_until FROM login_attempts WHERE ip = ?').get(ip) as any;
  if (!row) return { locked: false };

  if (row.locked_until) {
    const lockedUntil = new Date(row.locked_until).getTime();
    const now = Date.now();
    if (now < lockedUntil) {
      const waitMinutes = Math.ceil((lockedUntil - now) / 60000);
      return { locked: true, waitMinutes };
    }
  }

  return { locked: false };
}

export function recordLoginAttempt(ip: string, success: boolean) {
  const now = new Date().toISOString();
  if (success) {
    db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
    return;
  }

  const row = db.prepare('SELECT attempts FROM login_attempts WHERE ip = ?').get(ip) as any;
  const attempts = (row?.attempts || 0) + 1;
  let lockedUntil: string | null = null;

  if (attempts >= 5) {
    // Lock for 15 minutes
    lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }

  db.prepare(`
    INSERT INTO login_attempts (ip, attempts, locked_until, last_attempt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(ip) DO UPDATE SET
      attempts = excluded.attempts,
      locked_until = excluded.locked_until,
      last_attempt = excluded.last_attempt
  `).run(ip, attempts, lockedUntil, now);
}

// Helper to create admin session for single-user dev/preview mode
function createAutoAdminSession(req: Request, res: Response): string {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  db.prepare(`
    INSERT INTO sessions (id, user_id, ip, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, adminUser, ip, req.headers['user-agent'] || '', new Date().toISOString(), expiresAt);

  const signedCookie = signSession(sessionId);
  res.setHeader('X-New-Token', signedCookie);
  res.cookie('xmonitor_session', signedCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 86400 * 1000,
    path: '/',
  });
  return adminUser;
}

// Express Auth Middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Allow login, health and static routes without auth
  if (req.path === '/api/auth/login' || req.path === '/api/auth/status' || req.path === '/api/health') {
    return next();
  }

  const rawToken = (req.cookies?.['xmonitor_session'] as string | undefined) ||
                   req.headers['authorization']?.replace(/^Bearer\s+/, '') ||
                   (req.query?.token as string | undefined);

  if (!rawToken) {
    if (!process.env.ADMIN_PASSWORD_HASH) {
      const adminUser = createAutoAdminSession(req, res);
      (req as any).user = { id: adminUser, username: adminUser };
      return next();
    }
    return res.status(401).json({ error: 'احراز هویت انجام نشده است.' });
  }

  const sessionId = unsignSession(rawToken) || (rawToken.includes('.') ? rawToken.split('.')[0] : rawToken);
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionId) as any;

  if (!session || new Date(session.expires_at) < new Date()) {
    if (!process.env.ADMIN_PASSWORD_HASH) {
      const adminUser = createAutoAdminSession(req, res);
      (req as any).user = { id: adminUser, username: adminUser };
      return next();
    }
    return res.status(401).json({ error: 'نشست کاربری نامعتبر یا منقضی شده است.' });
  }

  (req as any).user = { id: session.user_id, username: ADMIN_USERNAME };
  next();
}

// CSRF Header check for mutating requests
export function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const xRequestedWith = req.headers['x-requested-with'];
    const xMonitorReq = req.headers['x-xmonitor-request'];
    if (!xRequestedWith && !xMonitorReq) {
      return res.status(403).json({ error: 'درخواست به دلیل عدم وجود هدر CSRF معتبر رد شد.' });
    }
  }
  next();
}
