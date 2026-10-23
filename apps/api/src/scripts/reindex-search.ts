import mongoose from 'mongoose';
import { config } from '../config.js';
import { reindexProducts } from '../search.js';

await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try { const count = await reindexProducts(); console.log(`Indexed ${count} published products`); }
finally { await mongoose.disconnect(); }
