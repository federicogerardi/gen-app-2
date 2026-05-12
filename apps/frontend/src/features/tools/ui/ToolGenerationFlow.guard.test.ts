import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resolveFrontendSrcRoot = (): string => {
  if (import.meta.url.startsWith('file:')) {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    let currentDir = testDir;
    while (true) {
      const appRootMarker = path.join(currentDir, 'App.tsx');
      const mainMarker = path.join(currentDir, 'main.tsx');
      if (fs.existsSync(appRootMarker) && fs.existsSync(mainMarker)) {
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  const cwdSrc = path.resolve(process.cwd(), 'src');
  if (fs.existsSync(cwdSrc)) {
    return cwdSrc;
  }

  return path.resolve(process.cwd(), 'apps/frontend/src');
};

const FRONTEND_SRC_ROOT = resolveFrontendSrcRoot();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', 'coverage', '.git']);

const walkFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) {
      continue;
    }

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
