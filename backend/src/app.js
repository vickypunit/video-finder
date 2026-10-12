import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config.js';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import { runSearch } from './services/pipeline.js';
import { createJobManager } from './services/jobs.js';

const searchSchema = z.object({
  input: z.string().trim().max(500).optional().default(''),
  // optional product photo as a data URL (validated and size-capped again in the pipeline)
  image: z.string().max(3_000_000).optional(),
  sources: z.object({
    instagram: z.boolean().default(true),
    meta_ads: z.boolean().default(true),
    tiktok: z.boolean().default(false),
  }).default({}),
}).refine((v) => v.input.length >= 2 || v.image, { message: 'Enter a product name or link, or upload a product image.', path: ['input'] });

export function createApp(db, deps = {}) {
  const { jobs: injectedJobs, ...runDeps } = deps;
  const jobs = injectedJobs || createJobManager({
    run: (params, { onProgress }) => runSearch(params, { db, ...runDeps, onProgress }),
  });
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '3mb' })); // room for one base64 product photo

  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t }, 'request'));
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, jobs: jobs.stats() }));
  app.get('/api/config', (_req, res) =>
    res.json({
      providerMode: config.providerMode, tiktokEnabled: config.tiktok.enabled, minPerSource: config.minPerSource,
      matchThreshold: config.matchThreshold, maxUploadBytes: config.maxUploadBytes,
      visionEnabled: config.providerMode === 'mock' || Boolean(config.anthropic.apiKey),
    }));

  const limiter = rateLimit({
    windowMs: 60_000, limit: config.rateLimitPerMinute, standardHeaders: true, legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many searches. Wait a minute and try again.')),
  });

  // Starts a background job and returns immediately (202). Follow it with GET /api/search/:id
  // or stream progress from GET /api/search/:id/events (SSE).
  app.post('/api/search', limiter, (req, res, next) => {
    try {
      const parsed = searchSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0].message);
      const job = jobs.submit(parsed.data);
      res.status(202).json({ jobId: job.id, status: job.status, statusUrl: `/api/search/${job.id}`, eventsUrl: `/api/search/${job.id}/events` });
    } catch (e) { next(e); }
  });

  app.get('/api/search/:id', (req, res, next) => {
    const job = jobs.get(req.params.id);
    if (!job) return next(new AppError(404, 'NOT_FOUND', 'That search job does not exist (it may have expired).'));
    res.json(job);
  });

  app.get('/api/search/:id/events', (req, res, next) => {
    if (!jobs.get(req.params.id)) return next(new AppError(404, 'NOT_FOUND', 'That search job does not exist (it may have expired).'));
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (type, data) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
      if (type === 'done' || type === 'error') res.end();
    };
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    const unsubscribe = jobs.subscribe(req.params.id, send);
    res.on('close', () => { clearInterval(heartbeat); unsubscribe?.(); });
  });

  app.get('/api/history', (_req, res) => res.json({ searches: db.listSearches() }));
  app.get('/api/history/:id', (req, res, next) => {
    const id = Number(req.params.id);
    const payload = Number.isInteger(id) ? db.getSearch(id) : null;
    if (!payload) return next(new AppError(404, 'NOT_FOUND', 'That search is not in your history.'));
    res.json({ id, ...payload });
  });
  app.get('/api/history/:id/previous', (req, res, next) => {
    const id = Number(req.params.id);
    const earlier = Number.isInteger(id) ? db.getEarlierVideos(id) : null;
    if (!earlier) return next(new AppError(404, 'NOT_FOUND', 'That search is not in your history.'));
    res.json({ results: earlier });
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
  app.locals.jobs = jobs;
  return app;
}
