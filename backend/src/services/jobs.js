import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { AppError } from '../errors.js';

/**
 * In-process job queue. POST /api/search returns a job id immediately; the search runs in the
 * background (at most `concurrency` at a time) and publishes progress events that the API
 * streams over SSE. A real deployment would swap this for BullMQ / a worker, the interface
 * (submit / get / subscribe) stays the same.
 */
export function createJobManager({ run, concurrency = config.jobConcurrency, ttlMs = config.jobTtlMs, maxQueued = 20 } = {}) {
  const jobs = new Map();
  const queue = [];
  let active = 0;

  const publicView = (j, { withResult = true } = {}) => ({
    id: j.id, status: j.status, stage: j.stage, createdAt: j.createdAt, progress: j.progress,
    searchId: j.result?.id ?? null,
    ...(withResult && j.status === 'done' ? { result: j.result } : {}),
    ...(j.status === 'error' ? { error: j.error } : {}),
  });

  function emit(job, event) {
    job.emitter.emit('event', event);
  }

  function push(job, p) {
    const evt = { at: Date.now(), ...p };
    job.stage = p.stage || job.stage;
    job.progress.push(evt);
    if (job.progress.length > 200) job.progress.shift();
    emit(job, { type: 'progress', data: evt });
  }

  async function execute(job) {
    job.status = 'running';
    push(job, { stage: 'starting', message: 'Starting' });
    try {
      job.result = await run(job.params, { onProgress: (p) => push(job, p) });
      job.status = 'done';
      emit(job, { type: 'done', data: publicView(job, { withResult: false }) });
    } catch (err) {
      const known = err instanceof AppError;
      if (!known) logger.error({ err: err.message, stack: err.stack, job: job.id }, 'job failed');
      job.status = 'error';
      job.error = { code: known ? err.code : 'INTERNAL', message: known ? err.message : 'Something went wrong on our side.' };
      emit(job, { type: 'error', data: job.error });
    } finally {
      active--;
      job.finishedAt = Date.now();
      pump();
    }
  }

  function pump() {
    while (active < concurrency && queue.length) {
      active++;
      execute(queue.shift());
    }
  }

  function sweep() {
    const now = Date.now();
    for (const [id, j] of jobs) if (j.finishedAt && now - j.finishedAt > ttlMs) jobs.delete(id);
  }

  return {
    submit(params) {
      sweep();
      if (queue.length >= maxQueued) throw new AppError(503, 'BUSY', 'The server is busy with other searches. Try again in a moment.');
      const job = { id: crypto.randomUUID(), params, status: 'queued', stage: 'queued', progress: [], createdAt: Date.now(), emitter: new EventEmitter() };
      jobs.set(job.id, job);
      queue.push(job);
      push(job, { stage: 'queued', message: 'Queued' });
      queueMicrotask(pump);
      return publicView(job, { withResult: false });
    },
    get: (id) => (jobs.has(id) ? publicView(jobs.get(id)) : null),
    /** Calls `send(type, data)` for the backlog and then for live events. Returns an unsubscribe fn. */
    subscribe(id, send) {
      const job = jobs.get(id);
      if (!job) return null;
      job.progress.forEach((p) => send('progress', p));
      if (job.status === 'done') { send('done', publicView(job, { withResult: false })); return () => {}; }
      if (job.status === 'error') { send('error', job.error); return () => {}; }
      const handler = (e) => send(e.type, e.data);
      job.emitter.on('event', handler);
      return () => job.emitter.off('event', handler);
    },
    stats: () => ({ active, queued: queue.length, tracked: jobs.size }),
  };
}
