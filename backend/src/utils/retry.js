const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry only what can plausibly succeed next time: network errors, timeouts and 5xx. */
export function isRetryable(err) {
  if (!err || err.rateLimited || err.noRetry) return false;
  if (typeof err.status === 'number') return err.status >= 500;
  return true;
}

export async function withRetry(fn, { retries = 2, baseMs = 300, shouldRetry = isRetryable, wait = sleep, onRetry } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      attempt++;
      onRetry?.(err, attempt);
      await wait(baseMs * 2 ** (attempt - 1));
    }
  }
}

export function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
      e.timeout = true;
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
