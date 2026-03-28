import { chromium, Browser, Page } from 'playwright';
import type { DOMElement, ScanResult } from '@/types';
import { listSourceFiles } from './file-utils';

let browser: Browser | null = null;

const MAX_ELEMENTS = 1200;

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'META',
  'LINK',
  'HEAD',
  'BR',
  'HR',
  'SVG',
  'PATH',
]);

/**
 * Initialize or reuse the Playwright browser instance.
 * Uses headless Chromium for DOM scanning.
 */
export async function initBrowser(): Promise<void> {
  if (browser && browser.isConnected()) return;

  console.log('[Playwright] Launching headless Chromium...');
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  console.log('[Playwright] Browser ready.');
}

/**
 * Close the browser instance and release resources.
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[Playwright] Browser closed.');
  }
}

/**
 * Scan a page at the given URL and extract DOM elements with bounding boxes.
 *
 * Steps:
 *  1. Launch/reuse browser
 *  2. Navigate to URL
 *  3. Wait for page load
 *  4. Take screenshot (base64)
 *  5. Extract DOM elements (max 200) with bounding boxes
 *  6. List source files from projectPath
 *  7. Return ScanResult
 */
export async function scanPage(url: string, projectPath: string): Promise<ScanResult> {
  await initBrowser();

  if (!browser) {
    throw new Error('[Playwright] Browser not initialized');
  }

  const page: Page = await browser.newPage();

  try {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log(`[Playwright] Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    // Wait a bit for any late-rendering JS frameworks
    await page.waitForTimeout(500);

    // Take screenshot as base64
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshot = screenshotBuffer.toString('base64');

    // Extract DOM elements via page.evaluate
    const elements: DOMElement[] = await page.evaluate(
      ({ maxElements, skipTags }) => {
        const results: DOMElement[] = [];
        let count = 0;

        function walkDOM(node: Element, depth: number): DOMElement | null {
          if (count >= maxElements) return null;
          if (!(node instanceof HTMLElement)) return null;

          const tagName = node.tagName.toUpperCase();
          if (skipTags.includes(tagName)) return null;

          // Skip invisible elements
          const style = window.getComputedStyle(node);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) {
            return null;
          }

          const rect = node.getBoundingClientRect();

          // Skip elements with zero dimensions
          if (rect.width === 0 && rect.height === 0) return null;

          count++;

          // Gather attributes
          const attributes: Record<string, string> = {};
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            if (['id', 'class', 'data-component', 'data-type', 'role', 'aria-label', 'href', 'src', 'alt'].includes(attr.name)) {
              attributes[attr.name] = attr.value;
            }
          }

          // Get text content (truncated, direct text only to avoid duplication)
          let textContent = '';
          for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
              textContent += (child.textContent || '').trim() + ' ';
            }
          }
          textContent = textContent.trim().slice(0, 100);

          // Process children
          const children: DOMElement[] = [];
          if (depth < 6) {
            for (const child of Array.from(node.children)) {
              const childResult = walkDOM(child, depth + 1);
              if (childResult) {
                children.push(childResult);
              }
            }
          }

          return {
            id: node.id || `el-${count}`,
            tagName: tagName.toLowerCase(),
            className: node.className || '',
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            visible: true,
            children,
            attributes,
            textContent,
          };
        }

        // Flatten: collect all meaningful elements, not just top-level
        function collectFlat(node: Element, depth: number): void {
          if (count >= maxElements) return;
          if (!(node instanceof HTMLElement)) return;

          const tagName = node.tagName.toUpperCase();
          if (skipTags.includes(tagName)) return;

          const style = window.getComputedStyle(node);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) return;

          const rect = node.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;

          if (rect.width > 4 && rect.height > 4) {
            count++;
            const attributes: Record<string, string> = {};
            for (let i = 0; i < node.attributes.length; i++) {
              const attr = node.attributes[i];
              if (['id', 'class', 'data-component', 'data-type', 'role', 'aria-label', 'href', 'src', 'alt'].includes(attr.name)) {
                attributes[attr.name] = attr.value;
              }
            }

            let textContent = '';
            for (const child of Array.from(node.childNodes)) {
              if (child.nodeType === Node.TEXT_NODE) {
                textContent += (child.textContent || '').trim() + ' ';
              }
            }
            textContent = textContent.trim().slice(0, 100);

            results.push({
              id: node.id || node.getAttribute('data-component') || `el-${count}`,
              tagName: tagName.toLowerCase(),
              className: node.className || '',
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              visible: true,
              children: [],
              attributes,
              textContent,
            });
          }

          // Always recurse into children
          if (depth < 8) {
            for (const child of Array.from(node.children)) {
              collectFlat(child, depth + 1);
            }
          }
        }

        const body = document.body;
        if (body) {
          for (const child of Array.from(body.children)) {
            collectFlat(child, 0);
          }
        }

        return results;
      },
      { maxElements: MAX_ELEMENTS, skipTags: Array.from(SKIP_TAGS) }
    );

    // List source files from project
    let sourceFiles: string[] = [];
    try {
      sourceFiles = await listSourceFiles(projectPath);
    } catch (err) {
      console.warn('[Playwright] Failed to list source files:', err);
    }

    console.log(
      `[Playwright] Scan complete: ${elements.length} elements, ${sourceFiles.length} source files`
    );

    return {
      url,
      timestamp: Date.now(),
      elements,
      screenshot,
      sourceFiles,
    };
  } finally {
    await page.close();
  }
}

/**
 * Take a screenshot of the given URL and return as base64 string.
 */
export async function takeScreenshot(url: string): Promise<string> {
  await initBrowser();

  if (!browser) {
    throw new Error('[Playwright] Browser not initialized');
  }

  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    const screenshotBuffer = await page.screenshot({ fullPage: true });
    return screenshotBuffer.toString('base64');
  } finally {
    await page.close();
  }
}
