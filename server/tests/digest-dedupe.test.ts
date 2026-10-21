import test from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../db/index.ts';
import { scheduler } from '../scheduler/poller.ts';

initDatabase();

test('posts already covered by a digest are not included again', async () => {
  const ids = ['dd-test-1', 'dd-test-2'];
  const now = new Date().toISOString();
  db.prepare("DELETE FROM posts WHERE x_post_id LIKE 'dd-test-%'").run();
  for (const id of ids) {
    db.prepare(`INSERT INTO posts (x_post_id, author_username, text, created_at, url, fetched_at, importance)
                VALUES (?, 'tester', ?, ?, 'https://x.com/tester/status/1', ?, 5)`).run(id, `post ${id}`, now, now);
  }
  db.prepare("UPDATE settings SET value = '1' WHERE key = 'digest_skip_repeated'").run();

  try {
    const first = await scheduler.runDigest();
    assert.ok(first.topPosts.some((id: string) => ids.includes(id)));
    const marked = db.prepare("SELECT COUNT(*) c FROM posts WHERE x_post_id LIKE 'dd-test-%' AND digested_at IS NOT NULL").get() as any;
    assert.equal(marked.c, 2);

    const second = await scheduler.runDigest();
    assert.ok(!second.topPosts.some((id: string) => ids.includes(id)));
  } finally {
    db.prepare("DELETE FROM posts WHERE x_post_id LIKE 'dd-test-%'").run();
  }
});
