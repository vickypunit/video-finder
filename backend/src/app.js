import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config.js';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import { runSearch } from './services/pipeline.js';

const searchSchema = z.object({
  input: z.string().trim().min(2, 'Enter a product name or link.').max(500),
  sources: z.object({
    instagram: z.boolean().default(true),
    meta_ads: z.boolean().default(true),
    tiktok: z.boolean().default(false),
  }).default({}),
});

export function createApp(db, deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '10kb' }));

  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t }, 'request'));
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', (_req, res) =>
    res.json({ providerMode: config.providerMode, tiktokEnabled: config.tiktok.enabled, minPerSource: config.minPerSource }));

  const limiter = rateLimit({
    windowMs: 60_000, limit: config.rateLimitPerMinute, standardHeaders: true, legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many searches. Wait a minute and try again.')),
  });

  app.post('/api/search', limiter, async (req, res, next) => {
    try {
      const parsed = searchSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0].message);
      res.json(await runSearch(parsed.data, { db, ...deps }));
    } catch (e) { next(e); }
  });

  app.get('/api/history', (_req, res) => res.json({ searches: db.listSearches() }));
  app.get('/api/history/:id', (req, res, next) => {
    const id = Number(req.params.id);
    const payload = Number.isInteger(id) ? db.getSearch(id) : null;
    if (!payload) return next(new AppError(404, 'NOT_FOUND', 'That search is not in your history.'));
    res.json({ id, ...payload });
  });
  app.delete('/api/history', (_req, res) => { db.clearAll(); res.json({ ok: true }); });

  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found.')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const known = err instanceof AppError;
    if (!known) logger.error({ err: err.message, stack: err.stack, path: req.path }, 'unhandled error');
    res.status(known ? err.status : 500).json({
      error: { code: known ? err.code : 'INTERNAL', message: known ? err.message : 'Something went wrong on our side.' },
    });
  });
  return app;
}
