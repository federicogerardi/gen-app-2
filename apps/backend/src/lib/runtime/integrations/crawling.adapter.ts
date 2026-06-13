/**
 * Crawling adapter — Puppeteer + stealth plugin for SERP extraction.
 * Used by invokeCrawling fromPromise actor in generation-system.actors.ts.
 */

let puppeteer: typeof import('puppeteer');
let StealthPlugin: typeof import('puppeteer-extra-plugin-stealth');

const loadPuppeteer = (): typeof puppeteer => {
  if (!puppeteer) {
    puppeteer = require('puppeteer');
  }
  return puppeteer;
};

const loadStealthPlugin = (): typeof StealthPlugin => {
  if (!StealthPlugin) {
    StealthPlugin = require('puppeteer-extra-plugin-stealth');
  }
  return StealthPlugin;
};

export type SourceType = 'organic' | 'sitelink' | 'video' | 'sponsored' | 'ugc' | 'news' | 'unknown';

export type CrawlingResult = {
  aiOverviewSnippet: string | null;
  sources: {
    title: string;
    url: string;
    snippet: string | null;
    sourceType: SourceType;
    sitelinks?: string[];
    videoMeta?: { platform: string; views?: string };
  }[];
  screenshotPath: string | null;
  adsCount: number;
  videoCount: number;
};

export const crawlSerp = async (
  query: string,
  language: string,
  country: string,
): Promise<CrawlingResult> => {
  void loadPuppeteer();
  const Stealth = loadStealthPlugin();

  const puppeteerExtra = require('puppeteer-extra');
  puppeteerExtra.use(Stealth());

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const searchUrl = `https://www.${country}/search?q=${encodeURIComponent(query)}&hl=${language}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extract AI Overview snippet
    const aiOverviewSnippet = await page.evaluate(() => {
      const overviewEl = document.querySelector('[data-snf]')
        ?? document.querySelector('.AIHVYe')
        ?? document.querySelector('[data-attrid="wa:/description"]');
      return overviewEl?.textContent?.trim() ?? null;
    });

    // Extract sources with type classification
    const sources = await page.evaluate(() => {
      const results = document.querySelectorAll('.g, .Zmcmbc, .dbsr, .g-blk');
      return Array.from(results).slice(0, 12).map((el) => {
        const isVideo = el.querySelector('video, .hTjNSe, [data-ved*="video"]') !== null ||
          el.querySelector('a[href*="youtube.com"]') !== null;
        const isSponsored = el.querySelector('.uEiDre, .tads, [data-text-ad]') !== null ||
          el.textContent?.includes('Sponsorizzato') ||
          el.textContent?.includes('Ad ·');
        const isNews = el.querySelector('.dbsr, [data-news]') !== null;
        const isUgc = el.querySelector('a[href*="reddit.com"], a[href*="quora.com"], a[href*="forum"], a[href*="community"]') !== null;
        const hasSitelinks = el.querySelectorAll('.s8GCU a, .VlD9Fd a').length > 0;

        const url = el.querySelector('a')?.href ?? '';
        const title = el.querySelector('h3')?.textContent?.trim() ?? '';
        const snippet = el.querySelector('[data-sncf], .VwiC3b, .s3v94d')?.textContent?.trim() ?? null;

        let sourceType: SourceType = 'organic';
        if (isSponsored) sourceType = 'sponsored';
        else if (isVideo) sourceType = 'video';
        else if (isNews) sourceType = 'organic';
        else if (isUgc) sourceType = 'ugc';
        else if (hasSitelinks) sourceType = 'sitelink';

        const sitelinks = hasSitelinks
          ? Array.from(el.querySelectorAll('.s8GCU a, .VlD9Fd a')).map((a) => (a as HTMLAnchorElement).textContent?.trim() ?? '').filter(Boolean)
          : undefined;

        const videoMeta = isVideo ? {
          platform: url.includes('youtube.com') ? 'YouTube' : 'Unknown',
          views: el.querySelector('.iJqaxd, .OCY7ub')?.textContent?.trim() ?? undefined,
        } : undefined;

        return {
          title,
          url,
          snippet,
          sourceType,
          sitelinks,
          videoMeta,
        };
      });
    });

    // Count ads and videos
    const typedSources = sources as { sourceType: SourceType }[];
    const adsCount = typedSources.filter((s) => s.sourceType === 'sponsored').length;
    const videoCount = typedSources.filter((s) => s.sourceType === 'video').length;

    // Take screenshot (storage only, never sent to LLM)
    const screenshotPath = `/tmp/serp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    await page.close();
    return { aiOverviewSnippet, sources, screenshotPath, adsCount, videoCount };
  } catch {
    await browser.close();
    throw new Error(`Crawling failed for query: ${query}`);
  }

  await browser.close();
};

export const discoverPAAQueries = async (
  baseQuery: string,
  language: string,
  country: string,
): Promise<string[]> => {
  void loadPuppeteer();
  const Stealth = loadStealthPlugin();

  const puppeteerExtra = require('puppeteer-extra');
  puppeteerExtra.use(Stealth());

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const searchUrl = `https://www.${country}/search?q=${encodeURIComponent(baseQuery)}&hl=${language}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Click PAA elements to expand them
    const paaSelectors = ['.related-question-pair', '.PZPBZc', '[jsname]'];
    for (const selector of paaSelectors) {
      const elements = await page.$$(selector);
      for (const el of elements.slice(0, 4)) {
        try {
          await el.click();
          await page.waitForTimeout(1000);
        } catch {
          // Element may not be clickable, continue
        }
      }
    }

    // Extract PAA queries
    const paaQueries = await page.evaluate(() => {
      const elements = document.querySelectorAll('.related-question-pair, .PZPBZc');
      return Array.from(elements)
        .slice(0, 4)
        .map((el) => el.textContent?.trim() ?? '')
        .filter((q) => q.length > 0);
    });

    await page.close();
    await browser.close();
    return paaQueries;
  } catch {
    await browser.close();
    return [];
  }
};
