import { config } from './config';
import { logger } from '../utils/logger';
import { MangaModel } from '../models/manga';
import mongoose from "mongoose";

type ConnectOptions = mongoose.ConnectOptions;

const {Schema, model, models} = mongoose;

let isConnected = false;
let connectionPromise: Promise<void> | null = null;

async function createCollections() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    logger.warn('Database connection not ready, skipping collection creation.');
    return;
  }

  try {
    const db = mongoose.connection.db;
    if (!db) {
      logger.warn('Database not initialized, skipping collection creation.');
      return;
    }

    // Get list of collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    // Create mangas collection if it doesn't exist
    if (!collectionNames.includes('mangas')) {
      logger.info('Creating mangas collection...');
      await db.createCollection('mangas');
      
      // Create indexes
      await MangaModel.createIndexes();
      logger.success('Created mangas collection and indexes');
    }
  } catch (error) {
    logger.error('Error creating collections:', error);
    throw error;
  }
}

export async function initDB() {
  // If already connected, return
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  try {
    logger.info('Connecting to MongoDB...');
    
    // Set mongoose options
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', true); // Enable command buffering
    
    // Create connection promise
    connectionPromise = mongoose.connect(config.db.uri, {
      bufferCommands: true, // Enable command buffering
      autoIndex: true, // Build indexes
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4
    } as ConnectOptions).then(async () => {
      // Wait for connection to be ready
      await mongoose.connection.asPromise();
      
      // Ensure collections exist
      await createCollections();
      
      isConnected = true;
      logger.success('Successfully connected to MongoDB');
    });

    await connectionPromise;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    connectionPromise = null;
    isConnected = false;
    throw error;
  } finally {
    connectionPromise = null;
  }
}

export async function closeDB() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('Closed database connection');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

// Add connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  isConnected = false;
});

export async function waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (isConnected && mongoose.connection.readyState === 1) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}
