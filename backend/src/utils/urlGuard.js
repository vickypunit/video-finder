import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from '../errors.js';

const ALLOWED_PORTS = new Set(['', '80', '443']);

export function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast / reserved
  );
}

export function isPrivateIPv6(ip) {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) {
    const tail = v.slice(7);
    return net.isIPv4(tail) ? isPrivateIPv4(tail) : true; // IPv4-mapped
  }
  return v.startsWith('fc') || v.startsWith('fd') || /^fe[89ab]/.test(v) || v.startsWith('ff');
}

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

/**
 * Throws AppError(400) unless `raw` is a public http(s) URL.
 * Resolves DNS and checks every returned address.
 */
export async function assertSafeUrl(raw, { lookup = dns.lookup } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, 'INVALID_URL', 'That is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(400, 'UNSAFE_URL', 'Only http and https links are allowed.');
  }
  if (url.username || url.password) {
    throw new AppError(400, 'UNSAFE_URL', 'Links with embedded credentials are not allowed.');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new AppError(400, 'UNSAFE_URL', 'Only the default web ports (80/443) are allowed.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new AppError(400, 'UNSAFE_URL', 'Internal addresses are not allowed.');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new AppError(400, 'UNSAFE_URL', 'Internal addresses are not allowed.');
    return url;
  }
  let addrs;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new AppError(400, 'UNRESOLVABLE_URL', 'Could not resolve that host.');
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new AppError(400, 'UNSAFE_URL', 'That host points to an internal address.');
  }
  return url;
}
