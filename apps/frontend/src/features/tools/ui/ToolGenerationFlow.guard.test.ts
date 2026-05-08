import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_SRC_ROOT = path.resolve(__dirname, '../../../..');

const walkFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
};

describe('ToolGenerationFlow static guard', () => {
  it('does not allow production imports or references to deprecated ToolGenerationFlow', () => {
    const files = walkFiles(FRONTEND_SRC_ROOT).filter((candidate) => {
      if (!candidate.endsWith('.ts') && !candidate.endsWith('.tsx')) {
        return false;
      }

      if (candidate.endsWith('.test.ts') || candidate.endsWith('.test.tsx')) {
        return false;
      }

      return true;
    });

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).not.toMatch(/\bToolGenerationFlow\b/);
      expect(content).not.toMatch(/['"]\.\/ToolGenerationFlow['"]/);
    }
  });
});
