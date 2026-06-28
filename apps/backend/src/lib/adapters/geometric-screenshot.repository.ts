import type { Pool } from 'pg';

export type ScreenshotMetadata = {
  id: string;
  session_id: string;
  request_id: string;
  query: string;
  is_paa: boolean;
  stored_path: string;
  file_size_bytes: number | null;
  ai_overview_confidence: number | null;
  selector_used: string | null;
  created_at: Date;
  expires_at: Date;
};

export type InsertScreenshotMetadataInput = {
  id: string;
  session_id: string;
  request_id: string;
  query: string;
  is_paa: boolean;
  stored_path: string;
  file_size_bytes: number | null;
  ai_overview_confidence: number | null;
  selector_used: string | null;
  expires_at: Date;
};

export const insertScreenshotMetadata = async (
  db: Pool,
  input: InsertScreenshotMetadataInput,
): Promise<void> => {
  await db.query(
    `INSERT INTO geometric_screenshot_metadata (
      id, session_id, request_id, query, is_paa, stored_path,
      file_size_bytes, ai_overview_confidence, selector_used, created_at, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
    [
      input.id,
      input.session_id,
      input.request_id,
      input.query,
      input.is_paa,
      input.stored_path,
      input.file_size_bytes,
      input.ai_overview_confidence,
      input.selector_used,
      input.expires_at,
    ],
  );
};

export const listScreenshotsBySession = async (
  db: Pool,
  sessionId: string,
): Promise<ScreenshotMetadata[]> => {
  const result = await db.query(
    `SELECT id, session_id, request_id, query, is_paa, stored_path,
            file_size_bytes, ai_overview_confidence, selector_used,
            created_at, expires_at
     FROM geometric_screenshot_metadata
     WHERE session_id = $1
     ORDER BY created_at DESC`,
    [sessionId],
  );

  return result.rows as ScreenshotMetadata[];
};

export const getScreenshotById = async (
  db: Pool,
  screenshotId: string,
): Promise<ScreenshotMetadata | null> => {
  const result = await db.query(
    `SELECT id, session_id, request_id, query, is_paa, stored_path,
            file_size_bytes, ai_overview_confidence, selector_used,
            created_at, expires_at
     FROM geometric_screenshot_metadata
     WHERE id = $1
     LIMIT 1`,
    [screenshotId],
  );

  return (result.rows[0] as ScreenshotMetadata | undefined) ?? null;
};

export const listAllScreenshots = async (
  db: Pool,
  limit: number = 100,
  offset: number = 0,
): Promise<ScreenshotMetadata[]> => {
  const result = await db.query(
    `SELECT id, session_id, request_id, query, is_paa, stored_path,
            file_size_bytes, ai_overview_confidence, selector_used,
            created_at, expires_at
     FROM geometric_screenshot_metadata
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  console.log(`[DEBUG][repo-screenshots] listAllScreenshots rowCount=${result.rowCount}, rows.length=${result.rows.length}`);
  return result.rows as ScreenshotMetadata[];
};

export const deleteExpiredScreenshots = async (
  db: Pool,
  now: Date,
): Promise<{ deletedRecords: number }> => {
  const result = await db.query(
    `DELETE FROM geometric_screenshot_metadata WHERE expires_at < $1`,
    [now],
  );

  return { deletedRecords: result.rowCount ?? 0 };
};
