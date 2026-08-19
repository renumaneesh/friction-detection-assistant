const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  if (process.env.NODE_ENV === 'test' && !process.env.MONGO_URI) {
    console.log('[DB] Running in test mode without explicit MONGO_URI.');
    return null;
  }

  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[DB] Warning: Could not connect to MongoDB at ${env.MONGO_URI}: ${error.message}`);
    console.warn('[DB] Proceeding with in-memory fallback store if DB operations occur.');
    return null;
  }
};

module.exports = connectDB;
