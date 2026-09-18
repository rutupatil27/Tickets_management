/**
 * npm run db:reset -- --confirm
 *
 * Deletes ALL application data (users, tickets, messages, notifications,
 * assignment history, ticket counter) and recreates only the admin account from
 * server/.env. Refuses to run without --confirm, and never runs in production.
 */
import mongoose from 'mongoose';
import { assertEnv, env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import {
  AssignmentHistory,
  Counter,
  Message,
  Notification,
  Ticket,
  User,
} from '../models/index.js';
import { logger } from '../utils/logger.js';
import { ensureAdminAccount, readAdminConfig } from './adminAccount.js';
import { removeAllUploads } from '../services/attachmentStorage.js';

const COLLECTIONS = { User, Ticket, Message, Notification, AssignmentHistory, Counter };

async function run() {
  if (!process.argv.includes('--confirm')) {
    logger.error('This deletes EVERY user, ticket and message. Re-run with: npm run db:reset -- --confirm');
    process.exit(1);
  }

  if (env.isProduction) {
    logger.error('Refusing to reset the database while NODE_ENV=production.');
    process.exit(1);
  }

  assertEnv();
  // Check the admin details BEFORE deleting anything, so a typo in .env can
  // never leave an empty database that nobody can sign in to.
  readAdminConfig();

  await connectDB();
  logger.info(`Resetting database "${mongoose.connection.name}"...`);

  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    const { deletedCount } = await Model.deleteMany({});
    logger.info(`   ${name.padEnd(18)} ${deletedCount} deleted`);
  }

  // Chat photos belong to the tickets that were just deleted.
  await removeAllUploads();
  logger.info('   Uploaded photos     deleted');

  const { user } = await ensureAdminAccount();
  logger.info(`Database is empty. Admin account ready: ${user.email}`);

  await disconnectDB();
}

run().catch(async (error) => {
  logger.error(error.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
