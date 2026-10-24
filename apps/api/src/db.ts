import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from './config.js';

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase(): Promise<{ uri: string; isMemory: boolean }> {
  // First attempt: Connect to configured MONGODB_URI (e.g. Docker or Atlas)
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[Database] Connected to external MongoDB at ${config.MONGODB_URI}`);
    return { uri: config.MONGODB_URI, isMemory: false };
  } catch (err) {
    if (config.NODE_ENV === 'production') {
      console.error('[Database] Failed to connect to production MongoDB:', err);
      throw err;
    }

    console.warn('[Database] Local MongoDB not reachable. Initializing zero-config in-memory MongoDB instance for development & demo...');
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'fs01',
      },
    });
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to in-memory MongoDB at ${memoryUri}`);
    return { uri: memoryUri, isMemory: true };
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
