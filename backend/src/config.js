import 'dotenv/config';

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

export const config = {
  port: int(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()),
  dbPath: process.env.DB_PATH || './data/app.db',
  providerMode: process.env.PROVIDER_MODE === 'live' ? 'live' : 'mock',
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  },
  instagram: { userId: process.env.IG_USER_ID || '', token: process.env.IG_ACCESS_TOKEN || '' },
  meta: {
    token: process.env.META_ACCESS_TOKEN || '',
    countries: (process.env.META_AD_COUNTRIES || 'GB,DE,FR').split(',').map((s) => s.trim()),
  },
  tiktok: { enabled: bool(process.env.TIKTOK_ENABLED), token: process.env.TIKTOK_ACCESS_TOKEN || '' },
  minPerSource: int(process.env.MIN_VIDEOS_PER_SOURCE, 20),
  maxPages: int(process.env.MAX_PAGES_PER_SOURCE, 8),
  rateLimitPerMinute: int(process.env.RATE_LIMIT_PER_MINUTE, 20),
};
