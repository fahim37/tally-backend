import mongoose from 'mongoose';
import env from './env.js';

// Strict query filtering: an undefined path in a filter throws instead of
// silently matching every document — worth having when queries are scoped by
// `user` and a typo would leak another account's expenses.
mongoose.set('strictQuery', true);

let connection = null;

export const connectDB = async () => {
  if (connection) return connection;

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });
  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  connection = await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: !env.isProduction, // build indexes in dev; use `npm run seed` / migrations in prod
  });

  return connection;
};

export const disconnectDB = async () => {
  if (!connection) return;
  await mongoose.disconnect();
  connection = null;
};

export default mongoose;
