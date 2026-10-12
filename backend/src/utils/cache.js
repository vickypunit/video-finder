/** Small in-memory TTL + size-bounded cache. Also de-duplicates in-flight work. */
export class TtlCache {
  constructor({ max = 200, ttlMs = 15 * 60 * 1000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value); // oldest first
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  /** Returns the cached value or runs `fn` once (concurrent callers share the same promise). Failures are not cached. */
  async getOrSet(key, fn) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = Promise.resolve().then(fn);
    this.set(key, pending);
    try {
      return await pending;
    } catch (err) {
      this.map.delete(key);
      throw err;
    }
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}
