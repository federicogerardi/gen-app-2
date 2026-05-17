import { chromium } from 'playwright';

const baseUrl = process.env.A11Y_BASE_URL ?? 'http://127.0.0.1:5173';
const adminEmail = process.env.A11Y_ADMIN_EMAIL ?? 'seed-user-001@example.local';
const adminPassword = process.env.A11Y_ADMIN_PASSWORD ?? 'password123';
const axeSourcePath = process.env.A11Y_AXE_SOURCE_PATH;
const cookieHeader = process.env.A11Y_COOKIE_HEADER ?? '';

const adminRoutes = [
  '/admin',
  '/admin/users',
  '/admin/models',
  '/admin/changelog',
  '/admin/user-reports',
  '/admin/activity',
];

const login = async (page) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: /email/i }).fill(adminEmail);
  await page.getByLabel(/password/i).fill(adminPassword);
  await page.getByRole('button', { name: /entra nel workspace/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
};

const seedSessionCookie = async (context) => {
  if (!cookieHeader) {
    return false;
  }

  const [pair] = cookieHeader.split(';');
  if (!pair || !pair.includes('=')) {
    return false;
  }

  const [name, ...valueParts] = pair.split('=');
  const value = valueParts.join('=');
  if (!name || !value) {
    return false;
  }

  const parsed = new URL(baseUrl);

  await context.addCookies([
    {
      name,
      value,
      domain: parsed.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  return true;
};

const runAxe = async (page) => {
  if (!axeSourcePath) {
    throw new Error('Missing A11Y_AXE_SOURCE_PATH environment variable.');
  }

  await page.addScriptTag({ path: axeSourcePath });

  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'rule',
        values: ['color-contrast'],
      },
    });

    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      nodes: violation.nodes.length,
    }));
  });
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const failures = [];

try {
  const seeded = await seedSessionCookie(context);
  if (!seeded) {
    await login(page);
  }

  for (const route of adminRoutes) {
    const url = `${baseUrl}${route}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    const violations = await runAxe(page);
    if (violations.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[axe] ${route}: OK`);
      continue;
    }

    failures.push({ route, violations });
    // eslint-disable-next-line no-console
    console.log(`[axe] ${route}: ${violations.length} violation(s)`);
    for (const violation of violations) {
      // eslint-disable-next-line no-console
      console.log(
        `  - ${violation.id} (${violation.impact ?? 'n/a'}) :: ${violation.help} [nodes=${violation.nodes}]`,
      );
    }
  }
} finally {
  await context.close();
  await browser.close();
}

if (failures.length > 0) {
  process.exitCode = 1;
  throw new Error(`Axe violations detected on ${failures.length} admin route(s).`);
}
