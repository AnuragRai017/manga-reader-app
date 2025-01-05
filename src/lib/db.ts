import { MongoClient, Db } from 'mongodb';
import 'dotenv/config';
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-reader';
const DB_NAME = process.env.DB_NAME || 'manga-reader';

class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect() {
    if (this.client && this.db) {
      return this.db;
    }

    try {
      this.client = await MongoClient.connect(MONGODB_URI);
      this.db = this.client.db(DB_NAME);
      console.log('Connected to MongoDB');
      return this.db;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async getDb() {
    if (!this.db) {
      await this.connect();
    }
    return this.db!;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('MongoDB connection closed');
    }
  }
}

export const database = new Database();

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || "");
    isConnected = true;
    console.log("Connected to MongoDB");
    return mongoose.connection;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw new Error("Failed to connect to MongoDB");
  }
};

export const closeDB = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("MongoDB connection closed");
  } catch (error) {
    console.error("Failed to close MongoDB connection", error);
    throw new Error("Failed to close MongoDB connection");
  }
};

export const db = {
  collection: async (name: string) => {
    const db = await database.getDb();
    return db.collection(name);
  }
};