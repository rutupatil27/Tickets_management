import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    // Some Windows/NAT64 setups resolve Atlas hosts to unreachable IPv6
    // addresses first and stall for 20s before falling back. Pinning the
    // driver to IPv4 avoids that entirely.
    family: 4,
    maxPoolSize: 20,
    autoIndex: !env.isProduction,
  });

  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
