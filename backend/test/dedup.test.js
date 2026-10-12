import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from '../src/services/dedup.js';

const v = (id, extra = {}) => ({ id, source: 'instagram', url: `https://ig.com/reel/${id}`, caption: `caption ${id}`, author: `a${id}`, ...extra });

test('drops videos already in search history', () => {
  const { fresh, droppedSeen } = dedupe([v('1'), v('2'), v('3')], new Set(['instagram:2']));
  assert.deepEqual(fresh.map((x) => x.id), ['1', '3']);
  assert.equal(droppedSeen, 1);
});

test('drops duplicate ids inside one batch', () => {
  const { fresh, droppedDuplicate } = dedupe([v('1'), v('1')]);
  assert.equal(fresh.length, 1);
  assert.equal(droppedDuplicate, 1);
});

test('drops same canonical url even if id differs (tracking params ignored)', () => {
  const a = v('1', { url: 'https://www.ig.com/reel/abc?utm=1' });
  const b = v('2', { url: 'https://ig.com/reel/abc/' });
  assert.equal(dedupe([a, b]).fresh.length, 1);
});

test('drops reposts: same author and same caption, different id/url', () => {
  const a = v('1', { author: 'sam', caption: 'Unboxing the Foo Bar bottle!' });
  const b = v('2', { author: 'sam', caption: 'unboxing the foo bar bottle' });
  assert.equal(dedupe([a, b]).fresh.length, 1);
});

test('same id on a different source is NOT a duplicate', () => {
  const a = v('1');
  const b = { ...v('1'), source: 'tiktok', url: 'https://tiktok.com/x' , author: 'zed', caption: 'other'};
  assert.equal(dedupe([a, b]).fresh.length, 2);
});
