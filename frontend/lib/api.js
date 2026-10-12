async function request(path, options) {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || 'Request failed. Check that the backend is running.');
  return body;
}

export const api = {
  config: () => request('/api/config'),
  history: () => request('/api/history'),
  historyItem: (id) => request(`/api/history/${id}`),
  clearHistory: () => request('/api/history', { method: 'DELETE' }),
  search: (input, sources) => request('/api/search', { method: 'POST', body: JSON.stringify({ input, sources }) }),
};
