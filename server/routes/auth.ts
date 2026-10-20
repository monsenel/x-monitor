import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  checkLoginLockout,
  getAdminProfile,
  hashPassword,
  recordLoginAttempt,
  requireAuth,
  requireCsrfHeader,
  signSession,
  unsignSession,
  verifyPassword,
} from '../security/auth.ts';
import { db } from '../db/index.ts';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function formatPublicUser(profile = getAdminProfile()) {
  return {
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  };
}

function upsertSetting(key: string, value: string) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, now);
}

authRouter.post('/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const lockout = checkLoginLockout(ip);
  if (lockout.locked) {
    return res.status(429).json({
      error: `Too many failed login attempts. Please wait ${lockout.waitMinutes} minutes.`,
    });
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const { username, password } = parsed.data;
  const profile = getAdminProfile();
  const normalizedInput = username.trim().toLowerCase();
  const matchesUser =
    normalizedInput === profile.username.toLowerCase() ||
    (profile.email && normalizedInput === profile.email.toLowerCase());

  if (!matchesUser || !verifyPassword(password, profile.passwordHash || undefined)) {
    recordLoginAttempt(ip, false);
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  recordLoginAttempt(ip, true);

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, ip, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, profile.username, ip, req.headers['user-agent'] || '', new Date().toISOString(), expiresAt);

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
    user: formatPublicUser(profile),
    token: signedCookie,
  });
});

authRouter.get('/status', (req, res) => {
  const rawToken =
    (req.cookies?.['xmonitor_session'] as string | undefined) ||
    req.headers['authorization']?.replace(/^Bearer\s+/, '') ||
    (req.query?.token as string | undefined);

  const profile = getAdminProfile();

  if (rawToken) {
    const sessionId = unsignSession(rawToken) || (rawToken.includes('.') ? rawToken.split('.')[0] : rawToken);
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionId) as any;

    if (session && new Date(session.expires_at) >= new Date()) {
      return res.json({
        authenticated: true,
        user: formatPublicUser(profile),
        token: rawToken,
      });
    }
  }

  // If no custom password hash is configured in env:
  // automatically create a valid session for seamless preview & iframe operation
  const storedEnvHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedEnvHash) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    db.prepare(`
      INSERT INTO sessions (id, user_id, ip, user_agent, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, profile.username, ip, req.headers['user-agent'] || '', new Date().toISOString(), expiresAt);

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
      user: formatPublicUser(profile),
      token: signedCookie,
    });
  }

  res.json({
    authenticated: false,
  });
});

authRouter.get('/profile', requireAuth, (_req, res) => {
  const profile = getAdminProfile();
  res.json({
    user: formatPublicUser(profile),
    hasCustomPassword: Boolean(profile.passwordHash),
  });
});

const updateProfileSchema = z.object({
  username: z.string().min(2).max(50).trim(),
  displayName: z.string().min(1).max(80).trim(),
  email: z.string().email().max(120).trim(),
  avatarUrl: z.string().max(2_000_000).optional().default(''),
});

authRouter.put('/profile', requireAuth, requireCsrfHeader, (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid profile data.',
    });
  }

  const { username, displayName, email, avatarUrl } = parsed.data;
  upsertSetting('profile_username', username);
  upsertSetting('profile_display_name', displayName);
  upsertSetting('profile_email', email);
  upsertSetting('profile_avatar', avatarUrl || '');

  // Keep existing sessions aligned with the new username
  db.prepare('UPDATE sessions SET user_id = ?').run(username);

  const updated = getAdminProfile();
  res.json({
    ok: true,
    user: formatPublicUser(updated),
  });
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});

authRouter.put('/password', requireAuth, requireCsrfHeader, (req, res) => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Password must be at least 6 characters.',
    });
  }

  const { currentPassword, newPassword } = parsed.data;
  const profile = getAdminProfile();

  if (!verifyPassword(currentPassword, profile.passwordHash || undefined)) {
    return res.status(400).json({
      error: 'Current password is incorrect.',
    });
  }

  const newHash = hashPassword(newPassword);
  upsertSetting('profile_password_hash', newHash);

  res.json({
    ok: true,
    message: 'Password updated successfully.',
  });
});

authRouter.post('/logout', (req, res) => {
  const rawToken =
    (req.cookies?.['xmonitor_session'] as string | undefined) ||
    req.headers['authorization']?.replace(/^Bearer\s+/, '');
  if (rawToken) {
    const sessionId = unsignSession(rawToken) || (rawToken.includes('.') ? rawToken.split('.')[0] : rawToken);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
  res.clearCookie('xmonitor_session', { path: '/' });
  res.json({ ok: true });
});

