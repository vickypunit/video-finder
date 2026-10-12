import pino from 'pino';
import { config } from './config.js';

// Structured JSON logs. Secrets are redacted if they ever end up in a log object.
export const logger = pino({
  level: config.logLevel,
  redact: ['*.token', '*.accessToken', '*.apiKey', 'req.headers.authorization'],
});
