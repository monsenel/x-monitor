import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.ts';

// Shared with the local Nitter container (mounted read-only there).
export function getSessionsFilePath(): string {
  return process.env.NITTER_SESSIONS_PATH || path.resolve(process.cwd(), 'data', 'nitter', 'sessions.jsonl');
}

// Accepts a plain number or the raw `twid` cookie value (u%3D123 / u=123).
export function parseTwid(raw: string): string | null {
  const m = decodeURIComponent(raw.trim()).match(/(\d{3,})/);
  return m ? m[1] : null;
}

// Nitter's cookie-session format: one JSON object per line.
export function syncNitterSessionsFile(): void {
  const rows = db.prepare('SELECT username, user_id, auth_token, ct0 FROM nitter_sessions').all() as any[];
  const body = rows
    .map((r) => JSON.stringify({ kind: 'cookie', username: r.username, id: r.user_id, auth_token: r.auth_token, ct0: r.ct0 }))
    .join('\n');
  const file = getSessionsFilePath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Write atomically so the Nitter watcher never reads a half-written file.
    // World-readable on purpose: the Nitter container runs as a different user and
    // this file lives on a volume shared only between the two containers.
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, body ? body + '\n' : '', { mode: 0o644 });
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error('Failed to write Nitter sessions file:', err);
  }
}
