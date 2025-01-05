import mongoose from 'mongoose';
import { initDB as connectToDb } from '../config/database';
import { logger } from '../utils/logger';

let isInitialized = false;

export async function initDB() {
  if (isInitialized) {
    logger.info('Database already initialized.');
    return;
  }
  logger.info('Initializing database...');
  await connectToDb(); // Use the correct function from database.ts
  isInitialized = true;
  logger.success('Database initialized successfully.');
}

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  isInitialized = false;
}); 