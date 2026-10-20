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
