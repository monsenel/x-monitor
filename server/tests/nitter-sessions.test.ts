import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTwid } from '../nitter/sessions.ts';
import { NitterRssProvider } from '../providers/nitter-rss.ts';
import { db, initDatabase } from '../db/index.ts';

initDatabase();

test('parseTwid accepts raw twid cookie and plain ids', () => {
  assert.equal(parseTwid('u%3D1234567890'), '1234567890');
  assert.equal(parseTwid('u=1234567890'), '1234567890');
  assert.equal(parseTwid('1234567890'), '1234567890');
  assert.equal(parseTwid('abc'), null);
});

test('nitter instances allow https and local http hosts only', () => {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'nitter_instances'").run(
    ['https://nitter.example.com', 'http://nitter:8080', 'http://evil.example.com', 'http://localhost:8080', 'ftp://x'].join('\n'),
  );
  const list = new NitterRssProvider().getInstances();
  assert.deepEqual(list, ['https://nitter.example.com', 'http://nitter:8080', 'http://localhost:8080']);
});
