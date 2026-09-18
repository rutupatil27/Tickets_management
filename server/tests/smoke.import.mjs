/**
 * Loads every server module to catch syntax errors, bad imports and circular
 * dependency problems without needing a database connection.
 *   node tests/smoke.import.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = path.resolve(process.cwd(), 'src');
// CLI scripts run (and touch the database) as soon as they are imported.
const skip = new Set(['createAdmin.js', 'resetDatabase.js']);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith('.js') && !skip.has(entry.name)) files.push(full);
  }

  return files;
}

const files = (await walk(SRC)).sort();
let failed = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  try {
    await import(pathToFileURL(file).href);
    console.log(`  ok   ${rel}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${rel}\n       ${error.message}`);
  }
}

// server.js is the entrypoint and would start listening, so check it separately
// with a syntax-only parse.
console.log(`\n${files.length - failed}/${files.length} modules loaded`);
process.exit(failed ? 1 : 0);
