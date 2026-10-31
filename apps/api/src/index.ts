import { app } from './app.js';
import { config } from './config.js';
import { closeCache } from './cache.js';
import { processOutboxBatch } from './search.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { seedCatalog } from './scripts/seed-data.js';

let server: ReturnType<typeof app.listen>;
let outboxTimer: NodeJS.Timeout;

async function start() {
  const { isMemory } = await connectDatabase();
  
  if (isMemory || config.NODE_ENV === 'development') {
    try {
      await seedCatalog();
    } catch (seedErr) {
      console.warn('[Seed] Note: Auto-seed skipped or non-fatal:', seedErr instanceof Error ? seedErr.message : seedErr);
    }
  }

  outboxTimer = setInterval(() => { void processOutboxBatch(); }, 5000);
  outboxTimer.unref();

  server = app.listen(config.API_PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 FS-01 Marketplace API listening on http://localhost:${config.API_PORT}`);
    console.log(`📖 Swagger API Documentation at http://localhost:${config.API_PORT}/docs`);
    console.log(`⚡ Mode: ${config.NODE_ENV} | DB Mode: ${isMemory ? 'In-Memory (Zero-Config)' : 'External URI'}`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    console.error('[HTTP Server Error]:', err);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at]:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]:', error);
});

start().catch(error => {
  console.error('startup_failed', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
});

async function shutdown() {
  clearInterval(outboxTimer);
  server?.close();
  await Promise.all([disconnectDatabase(), closeCache()]);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

