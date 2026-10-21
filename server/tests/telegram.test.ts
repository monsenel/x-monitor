import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatIds, splitMessage, escapeHtml, formatDigestForTelegram } from '../notify/telegram.ts';

test('parseChatIds splits on commas/newlines and de-duplicates', () => {
  assert.deepEqual(parseChatIds('111, -1001\n@chan\n111'), ['111', '-1001', '@chan']);
  assert.deepEqual(parseChatIds(''), []);
});

test('splitMessage keeps every chunk within the limit', () => {
  const text = Array.from({ length: 50 }, (_, i) => `line ${i} ` + 'x'.repeat(200)).join('\n');
  const chunks = splitMessage(text, 1000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 1000));
  assert.equal(chunks.join('\n'), text);
});

test('digest formatting escapes HTML from post/AI text', () => {
  const html = formatDigestForTelegram(
    { title: 'a <b>', content: 'x & y', groupSummaries: {} },
    [{ author: 'u', text: '<script>', url: 'https://x.com/u/1' }],
  );
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes(escapeHtml('<script>')));
});

import { parseCommand, buildIdReply } from '../notify/telegram-bot.ts';

test('parseCommand handles bot suffix and ignores plain text', () => {
  assert.equal(parseCommand('/id'), 'id');
  assert.equal(parseCommand('/ID@MyBot'), 'id');
  assert.equal(parseCommand('/start hello'), 'start');
  assert.equal(parseCommand('hello /id'), null);
});

test('buildIdReply shows user id, and chat id only for groups', () => {
  const priv = buildIdReply({ text: '/id', chat: { id: 5, type: 'private' }, from: { id: 5, username: 'u<' } });
  assert.ok(priv.includes('<code>5</code>') && !priv.includes('شناسه چت'));
  assert.ok(priv.includes('u&lt;'));
  const grp = buildIdReply({ text: '/id', chat: { id: -100123, type: 'supergroup', title: 'G' }, from: { id: 5 } });
  assert.ok(grp.includes('<code>-100123</code>'));
});
