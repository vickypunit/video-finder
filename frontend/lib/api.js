async function request(path, options) {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || 'Request failed. Check that the backend is running.');
  return body;
}

/**
 * Starts a search job, then follows it. Progress arrives over SSE (EventSource); the job is also
 * polled every second, so progress and the final result still arrive if a proxy buffers SSE.
 * Resolves with the finished search payload.
 */
function runSearchJob(body, onProgress) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let es = null;
    let timer = null;
    const seen = new Set();
    const emit = (p) => {
      const key = `${p.at}|${p.stage}|${p.message}`;
      if (seen.has(key)) return;
      seen.add(key);
      onProgress?.(p);
    };
    const end = (fn, value) => {
      if (finished) return;
      finished = true;
      es?.close();
      clearInterval(timer);
      fn(value);
    };

    request('/api/search', { method: 'POST', body: JSON.stringify(body) })
      .then(({ jobId }) => {
        if (typeof EventSource !== 'undefined') {
          es = new EventSource(`/api/search/${jobId}/events`);
          es.addEventListener('progress', (e) => emit(JSON.parse(e.data)));
          es.onerror = () => es.close(); // polling below keeps going
        }
        const poll = async () => {
          try {
            const job = await request(`/api/search/${jobId}`);
            job.progress.forEach(emit);
            if (job.status === 'done') end(resolve, job.result);
            else if (job.status === 'error') end(reject, new Error(job.error?.message || 'The search failed.'));
          } catch (err) {
            end(reject, err);
          }
        };
        timer = setInterval(poll, 1000);
        poll();
      })
      .catch((err) => end(reject, err));
  });
}

export const api = {
  config: () => request('/api/config'),
  history: () => request('/api/history'),
  historyItem: (id) => request(`/api/history/${id}`),
  previous: (id) => request(`/api/history/${id}/previous`),
  clearHistory: () => request('/api/history', { method: 'DELETE' }),
  search: runSearchJob,
};
