import crypto from 'node:crypto';
import { AppError } from '../errors.js';

const MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Parses and validates an uploaded "data:image/...;base64,..." string. */
export function parseImageDataUrl(dataUrl, maxBytes) {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!m || !MIME.has(m[1].toLowerCase())) {
    throw new AppError(400, 'INVALID_IMAGE', 'Upload a PNG, JPEG, WebP or GIF image.');
  }
  const data = m[2].replace(/\s+/g, '');
  const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (bytes > maxBytes) {
    throw new AppError(413, 'IMAGE_TOO_LARGE', `Image is too large (max ${(maxBytes / 1024 / 1024).toFixed(1)} MB).`);
  }
  return { mediaType: m[1].toLowerCase(), data, bytes, hash: crypto.createHash('sha1').update(data).digest('hex').slice(0, 16) };
}

/** Anthropic image block for the product photo (uploaded bytes win over a page URL). */
export function productImageBlock(product) {
  if (product.imageData) return { type: 'image', source: { type: 'base64', media_type: product.imageData.mediaType, data: product.imageData.data } };
  if (product.imageUrl && /^https?:\/\//i.test(product.imageUrl)) return { type: 'image', source: { type: 'url', url: product.imageUrl } };
  return null;
}

export const productImageKey = (product) => product.imageData?.hash || product.imageUrl || '';
