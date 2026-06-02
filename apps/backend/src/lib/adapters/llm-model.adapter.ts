import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  rowToLlmModel,
  type LlmModel,
  type LlmModelRow,
  type LlmModelStatus,
} from '../types/llm-model';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

function getDb(pool: Pool): Kysely<DB> {
  return createKyselyDb(pool);
}

export const listEnabledModels = async (pool: Pool): Promise<LlmModel[]> => {
  const rows = await getDb(pool)
    .selectFrom('llm_models')
    .selectAll()
    .where('status', '=', 'enabled')
    .orderBy('is_default', 'desc')
    .orderBy('sort_order', 'asc')
    .execute() as unknown as LlmModelRow[];

  return rows.map(rowToLlmModel);
};

export const listAllModels = async (pool: Pool): Promise<LlmModel[]> => {
  const rows = await getDb(pool)
    .selectFrom('llm_models')
    .selectAll()
    .orderBy('sort_order', 'asc')
    .execute() as unknown as LlmModelRow[];

  return rows.map(rowToLlmModel);
};

export const createModel = async (
  pool: Pool,
  payload: { key: string; label: string; status?: LlmModelStatus; isDefault?: boolean; sortOrder?: number },
): Promise<LlmModel> => {
  const row = await getDb(pool)
    .insertInto('llm_models')
    .values({
      id: sql<string>`gen_random_uuid()`,
      key: payload.key,
      label: payload.label,
      status: payload.status ?? 'enabled',
      is_default: payload.isDefault ?? false,
      sort_order: payload.sortOrder ?? null,
      created_at: sql`NOW()` as any,
      updated_at: sql`NOW()` as any,
    })
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as LlmModelRow;

  return rowToLlmModel(row);
};

export const updateModel = async (
  pool: Pool,
  id: string,
  payload: Partial<{ key: string; label: string; status: LlmModelStatus; isDefault: boolean; sortOrder: number }>,
): Promise<LlmModel | null> => {
  const db = getDb(pool);
  const { isDefault, ...rest } = payload;

  if (isDefault === true) {
    return await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('llm_models')
        .set({ is_default: false, updated_at: sql`NOW()` as any })
        .where('is_default', '=', true)
        .execute();

      const setValues: Record<string, unknown> = {};
      if (rest.key !== undefined) setValues.key = rest.key;
      if (rest.label !== undefined) setValues.label = rest.label;
      if (rest.status !== undefined) setValues.status = rest.status;
      if (rest.sortOrder !== undefined) setValues.sort_order = rest.sortOrder;
      setValues.is_default = true;
      setValues.updated_at = sql`NOW()` as any;

      const row = await trx
        .updateTable('llm_models')
        .set(setValues as any)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst() as unknown as LlmModelRow | undefined;

      return row ? rowToLlmModel(row) : null;
    });
  }

  const setValues: Record<string, unknown> = {};
  if (rest.key !== undefined) setValues.key = rest.key;
  if (rest.label !== undefined) setValues.label = rest.label;
  if (rest.status !== undefined) setValues.status = rest.status;
  if (rest.sortOrder !== undefined) setValues.sort_order = rest.sortOrder;
  if (isDefault !== undefined) setValues.is_default = isDefault;
  setValues.updated_at = sql`NOW()` as any;

  if (Object.keys(setValues).length === 1 && 'updated_at' in setValues) {
    const row = await db
      .selectFrom('llm_models')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst() as unknown as LlmModelRow | undefined;

    return row ? rowToLlmModel(row) : null;
  }

  const row = await db
    .updateTable('llm_models')
    .set(setValues as any)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst() as unknown as LlmModelRow | undefined;

  return row ? rowToLlmModel(row) : null;
};

export const deleteModel = async (pool: Pool, id: string): Promise<boolean> => {
  const result = await getDb(pool)
    .deleteFrom('llm_models')
    .where('id', '=', id)
    .execute();

  return Number(result[0]?.numDeletedRows ?? 0) > 0;
};
