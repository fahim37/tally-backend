// env.js must be imported before anything that reads process.env. ES module
// imports are hoisted, so calling dotenv.config() here in the module body would
// run *after* app.js and its transitive config had already been evaluated.
import env from './config/env.js';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';

let server;

const start = async () => {
  await connectDB();

  server = app.listen(env.PORT, () => {
    console.log(`Tally API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
};

const shutdown = async (signal, error) => {
  if (error) console.error(`${signal}:`, error);
  else console.log(`${signal} received, shutting down`);

  // Stop taking new connections, then close the DB, then leave.
  server?.close(async () => {
    await disconnectDB();
    process.exit(error ? 1 : 0);
  });

  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(error ? 1 : 0), 10_000).unref();
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => shutdown('UNHANDLED REJECTION', error));
process.on('uncaughtException', (error) => shutdown('UNCAUGHT EXCEPTION', error));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
