import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJson } from './gemini.ts';

test('extractJson extracts pure JSON array', () => {
  const input = '[{"postId":"1","importance":8}]';
  const res = extractJson(input);
  assert.equal(Array.isArray(res), true);
  assert.equal(res[0].postId, '1');
  assert.equal(res[0].importance, 8);
});

test('extractJson strips markdown code fence', () => {
  const input = '```json\n[{"postId":"2","sentiment":"positive"}]\n```';
  const res = extractJson(input);
  assert.equal(res[0].postId, '2');
  assert.equal(res[0].sentiment, 'positive');
});

test('extractJson extracts JSON object embedded in text', () => {
  const input = 'Here is the summary:\n{"title":"Test Summary","topPosts":["p1"]}\nHope this helps!';
  const res = extractJson(input);
  assert.equal(res.title, 'Test Summary');
  assert.deepEqual(res.topPosts, ['p1']);
});
