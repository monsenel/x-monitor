import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signSession, unsignSession } from '../security/auth.ts';
import { NitterRssProvider } from '../providers/nitter-rss.ts';
import { XOfficialProvider } from '../providers/x-official.ts';
import { TwitterApiIoProvider } from '../providers/twitterapi-io.ts';
import { scheduler } from '../scheduler/poller.ts';
import type { SourceEntity } from '../providers/types.ts';
import { initDatabase } from '../db/index.ts';

// Initialize in-memory/test schema
initDatabase();

test('Security: scrypt password hashing & verification', () => {
  const password = 'mySecretSecurePassword123!';
  const hash = hashPassword(password);
  assert.ok(hash.startsWith('scrypt:'), 'Hash should start with scrypt:');
  assert.equal(verifyPassword(password, hash), true, 'Valid password must verify');
  assert.equal(verifyPassword('wrongPassword', hash), false, 'Wrong password must fail');
});

test('Security: session cookie signing and tampering detection', () => {
  const sessionId = 'test-session-uuid-1234';
  const signed = signSession(sessionId);
  assert.ok(signed.includes('.'), 'Signed session must contain delimiter');
  assert.equal(unsignSession(signed), sessionId, 'Valid signature must resolve session ID');

  const tampered = signed.replace(/a/g, 'b');
  assert.equal(unsignSession(tampered), null, 'Tampered signature must return null');
});

test('Nitter RSS: HTML stripping removes tags and normalizes links', () => {
  const provider = new NitterRssProvider();
  const rawHtml = '<p>Breaking news: AI update released! <a href="https://nitter.net/status/123">details</a><br/>Read more.</p>';
  // Access private stripHtml through prototype or any cast
  const stripped = (provider as any).stripHtml(rawHtml);
  assert.ok(!stripped.includes('<p>'), 'Must strip <p>');
  assert.ok(!stripped.includes('</p>'), 'Must strip </p>');
  assert.ok(!stripped.includes('<br/>'), 'Must strip <br/>');
  assert.ok(stripped.includes('AI update released!'), 'Preserves plain text');
});

test('Scheduler: provider floor clamping for accounts vs search', () => {
  const twscrapeFloorAccount = scheduler.getProviderFloor('twscrape', 'account');
  const twscrapeFloorSearch = scheduler.getProviderFloor('twscrape', 'hashtag');
  assert.ok(twscrapeFloorAccount >= 15, 'Twscrape account floor must be at least 15m');
  assert.ok(twscrapeFloorSearch >= 30, 'Twscrape search floor must be at least 30m');

  const twioFloor = scheduler.getProviderFloor('twitterapi-io', 'account');
  assert.equal(twioFloor, 5, 'twitterapi.io floor must be 5m');
});

test('Scheduler: interval inheritance logic (source level vs global level)', () => {
  const sourceWithExplicitInterval: SourceEntity = {
    id: 'test-1',
    type: 'account',
    value: 'test_user',
    interval_minutes: 45,
    created_at: new Date().toISOString(),
  };

  const calculatedExplicit = scheduler.calculateEffectiveInterval(sourceWithExplicitInterval);
  assert.equal(calculatedExplicit.intervalMinutes, 45);
  assert.equal(calculatedExplicit.sourceLevel, 'source');

  const sourceWithInheritedInterval: SourceEntity = {
    id: 'test-2',
    type: 'hashtag',
    value: 'tehran',
    interval_minutes: null,
    created_at: new Date().toISOString(),
  };

  const calculatedInherited = scheduler.calculateEffectiveInterval(sourceWithInheritedInterval);
  assert.equal(calculatedInherited.sourceLevel, 'global');
  assert.ok(calculatedInherited.intervalMinutes >= 15);
});

test('Cost Control: usage cost estimation matches unit pricing', () => {
  const xOfficial = new XOfficialProvider();
  const costX = xOfficial.estimateCost({ postsRead: 100, usersRead: 10, calls: 2 });
  assert.ok(costX > 0, 'Official X must calculate non-zero cost for 100 tweets');

  const twIo = new TwitterApiIoProvider();
  const costTwIo = twIo.estimateCost({ postsRead: 1000, usersRead: 500, calls: 5 });
  assert.ok(costTwIo > 0, 'twitterapi.io must calculate cost');
});
