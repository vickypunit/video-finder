import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreVideo, scoreAll, WEIGHTS, WEIGHTS_VISUAL } from '../src/services/scoring.js';
import { mockVisual } from '../src/services/visualMatch.js';
import { idKey } from '../src/services/dedup.js';

const product = { title: 'Oversized Graphic Tee', brand: '' };
const brain = { keywords: ['oversized', 'graphic', 'tee'], hashtags: ['graphictee'], attributes: { color: ['black'], material: [], style: [], shape: [], use_case: [], brand: '' } };
const NOW = Date.parse('2026-10-12');
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('weights add up to 100 in both modes', () => {
  assert.equal(sum(WEIGHTS), 100);
  assert.equal(sum(WEIGHTS_VISUAL), 100);
});

test('a strong visual match lifts a caption-poor video, a weak one sinks it', () => {
  const video = { caption: 'new drop', postedAt: '2026-10-01' };
  const none = scoreVideo(video, product, brain, NOW);
  const good = scoreVideo(video, product, brain, NOW, { score: 95, reason: 'same print and colour' });
  const bad = scoreVideo(video, product, brain, NOW, { score: 5, reason: 'different product' });
  assert.ok(good.score > none.score, `${good.score} > ${none.score}`);
  assert.ok(bad.score < good.score);
  assert.ok(good.breakdown.visual >= 35);
});

test('score stays in 0..100 and breakdown sums to it with visual on', () => {
  const r = scoreVideo({ caption: 'oversized graphic tee '.repeat(6), likes: 1e9, postedAt: '2026-10-12' }, product, brain, NOW, { score: 100, reason: '' });
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.equal(sum(r.breakdown), r.score);
});

test('every score has a human reason, and it quotes the visual reason when present', () => {
  const r = scoreVideo({ caption: 'oversized graphic tee unboxing' }, product, brain, NOW, { score: 88, reason: 'same print, colour matches' });
  assert.match(r.reason, /Visual 88\/100: same print, colour matches/);
  assert.match(r.reason, /keywords/);
  const t = scoreVideo({ caption: 'cats', thumbnail: null }, product, brain, NOW);
  assert.match(t.reason, /text match only/i);
});

test('scoreAll flags low matches below the threshold and sorts best first', () => {
  const vids = [
    { id: '1', source: 'instagram', caption: 'pasta recipe' },
    { id: '2', source: 'instagram', caption: 'oversized graphic tee black #graphictee' },
  ];
  const out = scoreAll(vids, product, brain, new Map([[idKey(vids[1]), { score: 90, reason: 'ok' }]]), 40);
  assert.equal(out[0].id, '2');
  assert.equal(out[0].lowMatch, false);
  assert.equal(out[1].lowMatch, true);
  assert.equal(out[0].visualScore, 90);
});

test('mock visual is deterministic and separates on-topic from off-topic', () => {
  const vids = [{ id: 'a', source: 'instagram', caption: 'oversized tee review' }, { id: 'b', source: 'instagram', caption: 'easy pasta recipe' }];
  const a = mockVisual(vids, product);
  const b = mockVisual(vids, product);
  assert.deepEqual([...a], [...b]);
  assert.ok(a.get('instagram:a').score >= 55);
  assert.ok(a.get('instagram:b').score <= 25);
});
