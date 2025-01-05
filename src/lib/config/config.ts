export const config = {
  api: {
    mangadex: {
      baseUrl: 'https://api.mangadex.org',
      timeout: 30000, // 30 seconds
      batchSize: 25, // Keep within their 100 limit
      delayBetweenBatches: 5000, // 5 seconds to stay under 5 req/s limit
      maxRetries: 5,
      rateLimit: {
        requests: 5, // Global limit of 5 requests per second
        interval: 1000 // 1 second
      },
      headers: {
        'User-Agent': 'MangaReader/1.0 (https://github.com/AnuragRai017/manga-reader-app)', // Required
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  },
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/manga-reader',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 90000,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 60000,
      retryWrites: true,
      w: 'majority',
      bufferCommands: false,
      autoIndex: false
    }
  }
}; 