// Deterministic synthetic videos for development, tests and key-less demos.
// Every item carries mock:true so the UI can label it. Some items are deliberate
// reposts and some are off-topic, so de-dup and scoring have something to chew on.
import crypto from 'node:crypto';

const PAGE_SIZE = 25;
const OFF_TOPIC = ['morning routine vlog', 'my cat does a flip', 'travel diaries day 3', 'gym motivation monday', 'easy pasta recipe'];

function rng(seed) {
  let a = parseInt(crypto.createHash('md5').update(seed).digest('hex').slice(0, 8), 16);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mockPage(source, queries, cursor) {
  const page = cursor ? parseInt(cursor, 10) : 0;
  const base = (queries[0] || 'product').toLowerCase();
  const words = base.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < PAGE_SIZE; i++) {
    const n = page * PAGE_SIZE + i;
    const r = rng(`${source}|${base}|${n}`);
    const offTopic = r() < 0.2;
    const caption = offTopic
      ? OFF_TOPIC[Math.floor(r() * OFF_TOPIC.length)]
      : `${r() < 0.5 ? 'Honest review of' : 'Unboxing'} ${base} ${r() < 0.5 ? '- worth it?' : 'in real life'} #${words[0] || 'product'} #${words[words.length - 1] || 'review'}`;
    const author = `creator_${Math.floor(r() * 400)}`;
    // every 9th item is a repost of the previous one (same author + caption, new id)
    const repost = i % 9 === 8 && out.length;
    const src = repost ? out[out.length - 1] : null;
    out.push({
      id: `mock-${source}-${crypto.createHash('md5').update(base).digest('hex').slice(0, 6)}-${n}`,
      source,
      url: `https://example.com/${source}/${repost ? `repost-${n}` : `v${n}`}-${base.replace(/\s+/g, '-')}`,
      title: '',
      caption: src ? src.caption : caption,
      author: src ? src.author : author,
      thumbnail: null,
      hashtags: [],
      likes: Math.floor(r() * 50000),
      comments: Math.floor(r() * 900),
      views: Math.floor(r() * 400000),
      postedAt: new Date(Date.now() - Math.floor(r() * 200) * 86400000).toISOString(),
      mock: true,
    });
  }
  return { items: out, nextCursor: page >= 11 ? null : String(page + 1) };
}
