import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

const sqlDirArg = process.argv[2];
if (!sqlDirArg) {
  throw new Error('Usage: tsx db/scripts/run-sql-dir.ts <sql-directory> [--track|--no-track] [--table=<table_name>]');
}

const cliArgs = process.argv.slice(3);
const trackingEnabled = cliArgs.includes('--track') ? true : cliArgs.includes('--no-track') ? false : false;
const tableArg = cliArgs.find((arg) => arg.startsWith('--table='));
const trackingTable = tableArg ? tableArg.replace('--table=', '') : 'schema_migrations';

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trackingTable)) {
  throw new Error(`Invalid --table value: ${trackingTable}`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const sqlDir = path.resolve(sqlDirArg);
const sqlFiles = readdirSync(sqlDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort();

const buildMigrationKey = (fileName: string) => `${path.basename(sqlDir)}:${fileName}`;
const computeChecksum = (sql: string) => createHash('sha256').update(sql).digest('hex');

const ensureTrackingTable = async (client: Client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${trackingTable} (
      migration_key text PRIMARY KEY,
      file_name text NOT NULL,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const withTrackingLock = async (client: Client, fn: () => Promise<void>) => {
  await client.query("SELECT pg_advisory_lock(hashtext('infra-db:migrations-runner'))");
  try {
    await fn();
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('infra-db:migrations-runner'))");
  }
};

const run = async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (!trackingEnabled) {
      for (const fileName of sqlFiles) {
        const filePath = path.join(sqlDir, fileName);
        const sql = readFileSync(filePath, 'utf8');
        console.log(`Applying ${path.relative(process.cwd(), filePath)}`);
        await client.query(sql);
      }
      return;
    }

    await ensureTrackingTable(client);

    await withTrackingLock(client, async () => {
      for (const fileName of sqlFiles) {
        const filePath = path.join(sqlDir, fileName);
        const sql = readFileSync(filePath, 'utf8');
        const migrationKey = buildMigrationKey(fileName);
        const checksum = computeChecksum(sql);

        const previous = await client.query<{ checksum: string }>(
          `SELECT checksum FROM ${trackingTable} WHERE migration_key = $1`,
          [migrationKey],
        );

        if (previous.rowCount && previous.rows[0]) {
          if (previous.rows[0].checksum !== checksum) {
            throw new Error(
              `Migration ${migrationKey} was already applied with a different checksum. ` +
                'Create a new migration instead of editing an applied one.',
            );
          }

          console.log(`Skipping ${path.relative(process.cwd(), filePath)} (already applied)`);
          continue;
        }

        console.log(`Applying ${path.relative(process.cwd(), filePath)}`);
        await client.query(sql);

        await client.query(
          `INSERT INTO ${trackingTable} (migration_key, file_name, checksum) VALUES ($1, $2, $3)`,
          [migrationKey, fileName, checksum],
        );
      }
    });
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
