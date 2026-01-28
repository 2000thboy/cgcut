import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function diagnoseUI() {
  console.log('Starting UI Diagnosis...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Initial State Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diag_01_init.png'), fullPage: true });
    
    // Try to trigger the "Full Pipeline Check" if possible, or "Quick Demo"
    const quickDemoBtn = page.locator('button:has-text("导入脚本"), button:has-text("示例场景")').first();
    if (await quickDemoBtn.isVisible()) {
        console.log('Clicking Quick Demo/Import...');
        await quickDemoBtn.click();
        await page.waitForTimeout(2000);
    }

    const fullCheckBtn = page.locator('button:has-text("全链路检查")');
    if (await fullCheckBtn.isVisible()) {
        console.log('Clicking Full Pipeline Check...');
        await fullCheckBtn.click();
        // Wait for it to finish (approx 10-15s)
        await page.waitForTimeout(15000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diag_02_after_pipeline.png'), fullPage: true });
    }

    // Inspect for common layout issues
    const elements = await page.evaluate(() => {
        const results = [];
        const all = document.querySelectorAll('*');
        all.forEach(el => {
            const style = window.getComputedStyle(el);
            if (parseFloat(style.width) > window.innerWidth || parseFloat(style.height) > window.innerHeight) {
                // Potential overflow issue
                if (el.tagName !== 'BODY' && el.tagName !== 'HTML' && !el.id.includes('root')) {
                    results.push(`Overflow: ${el.tagName}.${el.className} (${style.width}x${style.height})`);
                }
            }
        });
        return results;
    });

    console.log('\n--- UI Elements Diagnostic ---');
    elements.slice(0, 10).forEach(e => console.log(e));

    console.log('\n--- Console Logs ---');
    consoleLogs.slice(-20).forEach(log => console.log(log));

  } catch (error) {
    console.error('Diagnosis Failed:', error);
  } finally {
    await browser.close();
    console.log('Diagnosis Complete.');
  }
}

diagnoseUI();
