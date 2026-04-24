import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

const sqlDirArg = process.argv[2];
if (!sqlDirArg) {
  throw new Error('Usage: tsx db/scripts/run-sql-dir.ts <sql-directory>');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const sqlDir = path.resolve(sqlDirArg);
const sqlFiles = readdirSync(sqlDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort();

const run = async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const fileName of sqlFiles) {
      const filePath = path.join(sqlDir, fileName);
      const sql = readFileSync(filePath, 'utf8');
      console.log(`Applying ${path.relative(process.cwd(), filePath)}`);
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
