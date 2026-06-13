import { randomUUID } from 'crypto';
import { stat, unlink } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';
import { logGeometricInfo, logGeometricError } from './geometric-logger';
import type { ScreenshotArchivalAdapter, ScreenshotArchivalParams } from '../../adapters/generation.adapters';
import type { ScreenshotStorageAdapter } from './screenshot-storage';

export class LocalScreenshotArchival implements ScreenshotArchivalAdapter {
  private readonly storage: ScreenshotStorageAdapter;
  private readonly db: Pool;
  private readonly retentionDays: number;

  constructor(storage: ScreenshotStorageAdapter, db: Pool, retentionDays: number) {
    this.storage = storage;
    this.db = db;
    this.retentionDays = retentionDays;
  }

  async archiveScreenshot(params: ScreenshotArchivalParams): Promise<string | null> {
    console.log(`[DEBUG][screenshot-archival] archiveScreenshot called — sessionId=${params.sessionId}, requestId=${params.requestId}, query=${params.query}, screenshotPath=${params.screenshotPath}`);
    const screenshotId = randomUUID();
    const storedPath = join(params.sessionId, `${screenshotId}.png`);
    const destPath = this.storage.getAbsolutePath(storedPath);
    console.log(`[DEBUG][screenshot-archival] computed paths — screenshotId=${screenshotId}, storedPath=${storedPath}, destPath=${destPath}`);

    let fileSizeBytes: number | null = null;
    try {
      const fileStat = await stat(params.screenshotPath);
      fileSizeBytes = fileStat.size;
      console.log(`[DEBUG][screenshot-archival] stat OK — fileSize=${fileSizeBytes}`);
    } catch (err) {
      fileSizeBytes = null;
      console.log(`[DEBUG][screenshot-archival] stat FAILED — error=${err instanceof Error ? err.message : 'unknown'}`);
    }

    try {
      await this.storage.save(params.screenshotPath, destPath);
      const insertResult = await this.db.query(
        `INSERT INTO geometric_screenshot_metadata (
          id, session_id, request_id, query, is_paa, stored_path,
          file_size_bytes, ai_overview_confidence, selector_used, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW() + INTERVAL '${this.retentionDays} days')`,
        [
          screenshotId,
          params.sessionId,
          params.requestId,
          params.query,
          params.isPaa,
          storedPath,
          fileSizeBytes,
          params.aiOverviewConfidence,
          params.selectorUsed,
        ],
      );
      console.log(`[DEBUG][screenshot-archival] INSERT rowCount=${insertResult.rowCount}, screenshotId=${screenshotId}`);
      logGeometricInfo('geometric.screenshot.archival.ok', {
        requestId: params.requestId,
        operation: 'archiveScreenshot',
        screenshotId,
        sessionId: params.sessionId,
        query: params.query,
        isPaa: params.isPaa,
      });
      return screenshotId;
    } catch (err) {
      logGeometricError('geometric.screenshot.archival.failed', {
        requestId: params.requestId,
        operation: 'archiveScreenshot',
        screenshotId,
        sessionId: params.sessionId,
        query: params.query,
        error: err instanceof Error ? err.message : 'archival_error',
      });
      return null;
    } finally {
      try {
        await unlink(params.screenshotPath);
      } catch {
        // Temp file may already be removed or not exist — ignore
      }
    }
  }

  async cleanupExpiredScreenshots(now: Date): Promise<{ deletedFiles: number; deletedRecords: number }> {
    const result = await this.db.query(
      `SELECT id, stored_path FROM geometric_screenshot_metadata WHERE expires_at < $1`,
      [now],
    );

    let deletedFiles = 0;
    let deletedRecords = 0;

    for (const row of result.rows) {
      try {
        await this.storage.delete(row.stored_path);
        deletedFiles += 1;
      } catch {
        // File may already be deleted or missing — count still
        deletedFiles += 1;
      }
    }

    const deleteResult = await this.db.query(
      `DELETE FROM geometric_screenshot_metadata WHERE expires_at < $1`,
      [now],
    );

    deletedRecords = deleteResult.rowCount ?? 0;

    return { deletedFiles, deletedRecords };
  }
}
