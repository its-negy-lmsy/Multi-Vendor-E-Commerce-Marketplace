import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { closeCache } from './cache.js';
import { processOutboxBatch } from './search.js';

let server: ReturnType<typeof app.listen>;
let outboxTimer: NodeJS.Timeout;
async function start() {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  outboxTimer = setInterval(() => { void processOutboxBatch(); }, 5000);
  outboxTimer.unref();
  server = app.listen(config.API_PORT, () => console.log(`FS-01 API listening on http://localhost:${config.API_PORT}`));
}
start().catch(error => { console.error('startup_failed', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
async function shutdown() { clearInterval(outboxTimer); server?.close(); await Promise.all([mongoose.disconnect(), closeCache()]); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
