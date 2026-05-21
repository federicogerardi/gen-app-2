import type { Pool, PoolClient } from 'pg';

import type { ProductionAdapterRuntime } from './postgres-redis.interfaces';

export const nowDate = (runtime?: ProductionAdapterRuntime): Date =>
  runtime?.now?.() ?? new Date();

export const randomId = (runtime?: ProductionAdapterRuntime): string =>
  runtime?.randomId?.() ?? Math.random().toString(36).slice(2, 14);

export const quoteIdentifier = (identifier: string): string => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

export const buildQualifiedTableName = (schema: string | undefined, table: string): string => {
  if (!schema) {
    return quoteIdentifier(table);
  }

  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

export const withTransaction = async <T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
