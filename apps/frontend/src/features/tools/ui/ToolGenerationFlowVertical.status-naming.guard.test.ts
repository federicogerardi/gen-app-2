import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resolveFrontendSrcRoot = (): string => {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  let currentDir = testDir;

  for (let depth = 0; depth < 20; depth += 1) {
    const appMarker = path.join(currentDir, 'App.tsx');
    const mainMarker = path.join(currentDir, 'main.tsx');
    if (fs.existsSync(appMarker) && fs.existsSync(mainMarker)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return path.resolve(process.cwd(), 'src');
};

const FRONTEND_SRC_ROOT = resolveFrontendSrcRoot();

const FLOW_COMPONENT_PATH = path.join(
  FRONTEND_SRC_ROOT,
  'features/tools/ui/ToolGenerationFlowVertical.tsx',
);

const FLOW_TEST_PATH = path.join(
  FRONTEND_SRC_ROOT,
  'features/tools/ui/ToolGenerationFlowVertical.test.tsx',
);

const FLOW_STYLE_PATH = path.join(FRONTEND_SRC_ROOT, 'styles.css');

const readUtf8 = (filePath: string): string => fs.readFileSync(filePath, 'utf8');

describe('ToolGenerationFlowVertical status naming guard', () => {
  it('uses canonical completed naming for preload bar across component, css and tests', () => {
    const component = readUtf8(FLOW_COMPONENT_PATH);
    const stylesheet = readUtf8(FLOW_STYLE_PATH);
    const test = readUtf8(FLOW_TEST_PATH);

    // Canonical state token for the preload bar completion variant.
    expect(component).toMatch(/type\s+BarVariant\s*=\s*[^\n]*'completed'/);
    expect(component).not.toMatch(/type\s+BarVariant\s*=\s*[^\n]*'done'/);

    // Canonical CSS class for preload completion.
    expect(stylesheet).toMatch(/\.workflow-preload-bar\.is-completed\s*\{/);
    expect(stylesheet).not.toMatch(/\.workflow-preload-bar\.is-done\s*\{/);

    // Tests must assert canonical class naming.
    expect(test).toMatch(/toHaveClass\('is-completed'\)/);
    expect(test).not.toMatch(/toHaveClass\('is-done'\)/);
  });
});