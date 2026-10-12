import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreVideo } from '../src/services/scoring.js';

const product = { title: 'Hydro Steel Water Bottle', brand: 'Hydro' };
const brain = {
  keywords: ['water', 'bottle', 'steel', 'insulated'],
  hashtags: ['waterbottle', 'hydrate'],
  attributes: { color: ['matte black'], material: ['steel'], style: [], shape: [], use_case: ['gym'], brand: 'Hydro' },
};
const NOW = Date.parse('2026-10-12');

test('on-topic video scores high', () => {
  const { score } = scoreVideo({
    caption: 'Hydro Steel Water Bottle review - matte black insulated steel bottle for the gym #waterbottle #hydrate',
    likes: 20000, comments: 400, views: 200000, postedAt: '2026-10-01',
  }, product, brain, NOW);
  assert.ok(score >= 80, `expected >=80 got ${score}`);
});

test('off-topic video scores low', () => {
  const { score } = scoreVideo({ caption: 'my cat does a flip', likes: 10, postedAt: '2024-01-01' }, product, brain, NOW);
  assert.ok(score <= 10, `expected <=10 got ${score}`);
});

test('score is always within 0..100 and breakdown sums to it', () => {
  const r = scoreVideo({ caption: product.title.repeat(5), likes: 1e9, comments: 1e9, views: 1e12, postedAt: '2026-10-12' }, product, brain, NOW);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.equal(Object.values(r.breakdown).reduce((a, b) => a + b, 0), r.score);
});

test('missing fields do not crash', () => {
  assert.equal(typeof scoreVideo({}, product, { keywords: [] }, NOW).score, 'number');
});

test('ranking: relevant beats irrelevant', () => {
  const good = scoreVideo({ caption: 'steel water bottle unboxing', postedAt: '2026-09-01' }, product, brain, NOW).score;
  const bad = scoreVideo({ caption: 'pasta recipe', postedAt: '2026-09-01' }, product, brain, NOW).score;
  assert.ok(good > bad);
});
