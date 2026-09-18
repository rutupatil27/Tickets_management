/**
 * npm run create-admin
 *
 * Creates the first admin account from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD
 * in server/.env. Run once after setting up a new database.
 */
import { assertEnv } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { ensureAdminAccount } from './adminAccount.js';

async function run() {
  assertEnv();
  await connectDB();

  const { created, user } = await ensureAdminAccount();

  if (created) {
    logger.info(`Admin account created: ${user.email}`);
    logger.info('Sign in with the password from server/.env, then change it from My profile.');
  } else {
    logger.info(`Admin account already exists: ${user.email} - nothing changed.`);
  }

  await disconnectDB();
}

run().catch(async (error) => {
  logger.error(error.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
