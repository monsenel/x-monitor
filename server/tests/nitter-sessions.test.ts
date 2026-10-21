import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTwid } from '../nitter/sessions.ts';
import { NitterRssProvider } from '../providers/nitter-rss.ts';
import { initDatabase } from '../db/index.ts';

initDatabase();

test('parseTwid accepts raw twid cookie and plain ids', () => {
  assert.equal(parseTwid('u%3D1234567890'), '1234567890');
  assert.equal(parseTwid('u=1234567890'), '1234567890');
  assert.equal(parseTwid('1234567890'), '1234567890');
  assert.equal(parseTwid('abc'), null);
});

test('only the local Nitter is used as an instance', () => {
  delete process.env.NITTER_LOCAL_URL;
  assert.deepEqual(new NitterRssProvider().getInstances(), ['http://nitter:8080']);
  process.env.NITTER_LOCAL_URL = 'http://localhost:9999/';
  assert.deepEqual(new NitterRssProvider().getInstances(), ['http://localhost:9999']);
  delete process.env.NITTER_LOCAL_URL;
});
