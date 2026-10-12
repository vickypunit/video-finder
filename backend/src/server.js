import { config } from './config.js';
import { logger } from './logger.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

const db = openDb();
createApp(db).listen(config.port, () =>
  logger.info({ port: config.port, providerMode: config.providerMode }, 'backend listening'));
