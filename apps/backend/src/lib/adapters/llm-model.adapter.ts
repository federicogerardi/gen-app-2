/**
 * LlmModelCatalog DB adapter.
 * Implements CRUD operations for LlmModel entities.
 * DDD-055: LlmModelCatalog is the service-layer term for model catalog management.
 */

import type { Pool } from 'pg';
import { rowToLlmModel, type LlmModel, type LlmModelRow, type LlmModelStatus } from '../types/llm-model';

const ORDER_CLAUSE = 'ORDER BY sort_order ASC NULLS LAST, created_at ASC';
const SELECT_COLS = 'id, key, label, status, is_default, sort_order, created_at, updated_at';

export const listEnabledModels = async (db: Pool): Promise<LlmModel[]> => {
  const result = await db.query<LlmModelRow>(
    `SELECT ${SELECT_COLS}
     FROM llm_models
     WHERE status = 'enabled'
     ${ORDER_CLAUSE}`,
  );
  return result.rows.map(rowToLlmModel);
};

export const listAllModels = async (db: Pool): Promise<LlmModel[]> => {
  const result = await db.query<LlmModelRow>(
    `SELECT ${SELECT_COLS}
     FROM llm_models
     ${ORDER_CLAUSE}`,
  );
  return result.rows.map(rowToLlmModel);
};

export const createModel = async (
  db: Pool,
  payload: { key: string; label: string; status?: LlmModelStatus; isDefault?: boolean; sortOrder?: number },
): Promise<LlmModel> => {
  const result = await db.query<LlmModelRow>(
    `INSERT INTO llm_models (key, label, status, is_default, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLS}`,
    [
      payload.key,
      payload.label,
      payload.status ?? 'enabled',
      payload.isDefault ?? false,
      payload.sortOrder ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Insert returned no row');
  }
  return rowToLlmModel(row);
};

export const updateModel = async (
  db: Pool,
  id: string,
  payload: Partial<{ key: string; label: string; status: LlmModelStatus; isDefault: boolean; sortOrder: number }>,
): Promise<LlmModel | null> => {
  const { isDefault, ...rest } = payload;

  // If isDefault is being set to true, run an atomic transaction:
  // unset any existing default, then apply all changes to the target model.
  if (isDefault === true) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Clear existing default (partial unique index allows only one TRUE)
      await client.query(
        `UPDATE llm_models SET is_default = FALSE, updated_at = now() WHERE is_default = TRUE AND id != $1`,
        [id],
      );
      const setClauses: string[] = ['is_default = TRUE'];
      const values: unknown[] = [];
      let idx = 1;

      if (rest.key !== undefined) { setClauses.push(`key = $${idx++}`); values.push(rest.key); }
      if (rest.label !== undefined) { setClauses.push(`label = $${idx++}`); values.push(rest.label); }
      if (rest.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(rest.status); }
      if (rest.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(rest.sortOrder); }
      setClauses.push(`updated_at = now()`);
      values.push(id);

      const result = await client.query<LlmModelRow>(
        `UPDATE llm_models SET ${setClauses.join(', ')} WHERE id = $${idx}
         RETURNING ${SELECT_COLS}`,
        values,
      );
      await client.query('COMMIT');
      return result.rows[0] ? rowToLlmModel(result.rows[0]) : null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Non-default-swap update: regular SET clause.
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (rest.key !== undefined) { setClauses.push(`key = $${idx++}`); values.push(rest.key); }
  if (rest.label !== undefined) { setClauses.push(`label = $${idx++}`); values.push(rest.label); }
  if (rest.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(rest.status); }
  if (rest.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(rest.sortOrder); }
  // isDefault === false: explicitly unset (only allowed if model is not the current default via DB constraint)
  if (isDefault === false) { setClauses.push(`is_default = $${idx++}`); values.push(false); }

  if (setClauses.length === 0) {
    const existing = await db.query<LlmModelRow>(
      `SELECT ${SELECT_COLS} FROM llm_models WHERE id = $1`,
      [id],
    );
    return existing.rows[0] ? rowToLlmModel(existing.rows[0]) : null;
  }

  setClauses.push(`updated_at = now()`);
  values.push(id);

  const result = await db.query<LlmModelRow>(
    `UPDATE llm_models SET ${setClauses.join(', ')} WHERE id = $${idx}
     RETURNING ${SELECT_COLS}`,
    values,
  );
  return result.rows[0] ? rowToLlmModel(result.rows[0]) : null;
};

export const deleteModel = async (db: Pool, id: string): Promise<boolean> => {
  const result = await db.query('DELETE FROM llm_models WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
