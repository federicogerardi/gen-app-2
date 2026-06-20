import { copyFile, mkdir, unlink } from 'fs/promises';
import { dirname, join } from 'path';

export interface ScreenshotStorageAdapter {
  save(sourcePath: string, destPath: string): Promise<void>;
  getAbsolutePath(storedPath: string): string;
  delete(storedPath: string): Promise<void>;
}

export class LocalScreenshotStorage implements ScreenshotStorageAdapter {
  private readonly storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async save(sourcePath: string, destPath: string): Promise<void> {
    console.log(`[DEBUG][screenshot-storage] save called — sourcePath=${sourcePath}, destPath=${destPath}`);
    try {
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(sourcePath, destPath);
      console.log(`[DEBUG][screenshot-storage] save OK — destPath=${destPath}`);
    } catch (err) {
      console.log(`[DEBUG][screenshot-storage] save FAILED — error=${err instanceof Error ? err.message : 'unknown'}`);
      throw err;
    }
  }

  getAbsolutePath(storedPath: string): string {
    return join(this.storagePath, storedPath);
  }

  async delete(storedPath: string): Promise<void> {
    await unlink(this.getAbsolutePath(storedPath));
  }
}
