const STOP = new Set(('a an the and or of for to in on with by from at as is are be this that it its your you our new best buy ' +
  'sale offer free shipping online india official store shop pack set pcs piece').split(' '));

export function tokenize(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^#/, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function normalizeCaption(str = '') {
  return String(str).toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function canonicalUrl(u = '') {
  try {
    const x = new URL(u);
    x.hash = '';
    x.search = '';
    return (x.host.replace(/^www\./, '') + x.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
}
