import { MongoClient, Db } from 'mongodb';
import 'dotenv/config';


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

// For backward compatibility
export const connectDB = () => database.connect();
export const closeDB = () => database.close();
export const db = {
  collection: async (name: string) => {
    const db = await database.getDb();
    return db.collection(name);
  }
};