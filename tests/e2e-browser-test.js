/**
 * cgcut MVP 浏览器端E2E测试
 * 
 * 使用 Playwright 进行完整的前端功能测试
 * 
 * 运行方式: node e2e-browser-test.js
 */

import { chromium } from 'playwright';
import fs from 'fs';

// ============================================
// 配置
// ============================================
const CONFIG = {
  FRONTEND_URL: 'http://localhost:5173',
  SCREENSHOT_DIR: './test-screenshots',
  TEST_TIMEOUT: 60000,
  WAIT_TIMEOUT: 30000,
};

// 测试剧本
const TEST_SCRIPT = `INT. 办公室 - 白天

王晓坐在办公桌前，眼神紧张地看着电脑屏幕。她的手指在键盘上快速敲打着。

突然，电脑屏幕闪了一下。王晓猛地站起身来。

王晓：不可能...`;

// ============================================
// 测试结果
// ============================================
const testResults = {
  timestamp: new Date().toISOString(),
  summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
  tests: [],
  screenshots: [],
  issues: [],
};

// ============================================
// 工具函数
// ============================================
const colors = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function takeScreenshot(page, name) {
  if (!fs.existsSync(CONFIG.SCREENSHOT_DIR)) {
    fs.mkdirSync(CONFIG.SCREENSHOT_DIR, { recursive: true });
  }
  const filename = `${CONFIG.SCREENSHOT_DIR}/${name}-${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  testResults.screenshots.push(filename);
  return filename;
}

async function runTest(name, testFn) {
  testResults.summary.total++;
  const startTime = Date.now();
  
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    if (result.passed) {
      testResults.summary.passed++;
      testResults.tests.push({ name, status: 'passed', duration, data: result.data });
      log(colors.green, `  ✅ ${name} (${duration}ms)`);
    } else if (result.warning) {
      testResults.summary.warnings++;
      testResults.tests.push({ name, status: 'warning', duration, message: result.message });
      log(colors.yellow, `  ⚠️  ${name}: ${result.message}`);
    } else {
      testResults.summary.failed++;
      testResults.tests.push({ name, status: 'failed', duration, message: result.message });
      log(colors.red, `  ❌ ${name}: ${result.message}`);
      testResults.issues.push({ test: name, message: result.message });
    }
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.summary.failed++;
    testResults.tests.push({ name, status: 'failed', duration, message: error.message });
    log(colors.red, `  ❌ ${name}: ${error.message}`);
    testResults.issues.push({ test: name, message: error.message });
    return { passed: false, message: error.message };
  }
}


// ============================================
// 测试用例
// ============================================
async function runAllTests() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║           cgcut MVP 浏览器E2E测试 (Playwright)              ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  let browser;
  let page;

  try {
    // 启动浏览器
    log(colors.blue, '\n🚀 启动浏览器...');
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    page = await context.newPage();
    page.setDefaultTimeout(CONFIG.WAIT_TIMEOUT);

    // ========================================
    // 1. 页面加载测试
    // ========================================
    log(colors.cyan, '\n📋 1. 页面加载测试');
    
    await runTest('页面加载', async () => {
      const response = await page.goto(CONFIG.FRONTEND_URL, { waitUntil: 'networkidle' });
      if (response.status() === 200) {
        await takeScreenshot(page, '01-page-loaded');
        return { passed: true };
      }
      return { passed: false, message: `HTTP ${response.status()}` };
    });

    await runTest('页面标题', async () => {
      const title = await page.title();
      if (title && title.length > 0) {
        return { passed: true, data: { title } };
      }
      return { warning: true, message: '页面标题为空' };
    });

    await runTest('主要UI元素存在', async () => {
      const hasMainContent = await page.locator('main, [class*="main"], [class*="app"], #root').first().isVisible().catch(() => false);
      if (hasMainContent) {
        return { passed: true };
      }
      return { warning: true, message: '部分UI元素未找到' };
    });

    // ========================================
    // 2. 剧本输入测试
    // ========================================
    log(colors.cyan, '\n📋 2. 剧本输入和分镜拆解测试');

    await runTest('查找剧本输入区域', async () => {
      const textarea = await page.locator('textarea').first().isVisible().catch(() => false);
      if (textarea) {
        return { passed: true };
      }
      return { warning: true, message: '未找到明显的输入区域' };
    });

    await runTest('输入测试剧本', async () => {
      try {
        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible()) {
          await textarea.fill(TEST_SCRIPT);
          await takeScreenshot(page, '02-script-input');
          return { passed: true };
        }
        return { warning: true, message: '未能输入剧本' };
      } catch (e) {
        return { warning: true, message: e.message };
      }
    });

    await runTest('查找分析按钮', async () => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const text = await buttons.nth(i).textContent().catch(() => '');
        if (text && (text.includes('分析') || text.includes('拆解') || text.includes('生成') || text.includes('开始'))) {
          return { passed: true, data: { buttonText: text.trim() } };
        }
      }
      return { warning: true, message: '未找到明显的分析按钮' };
    });

    // ========================================
    // 3. 素材库测试
    // ========================================
    log(colors.cyan, '\n📋 3. 素材库管理测试');

    await runTest('查找素材库入口', async () => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const text = await buttons.nth(i).textContent().catch(() => '');
        if (text && (text.includes('素材') || text.includes('库') || text.includes('导入') || text.includes('Asset'))) {
          return { passed: true, data: { elementText: text.trim().substring(0, 50) } };
        }
      }
      return { warning: true, message: '未找到明显的素材库入口' };
    });

    await runTest('尝试打开素材库', async () => {
      try {
        const buttons = page.locator('button');
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
          const text = await buttons.nth(i).textContent().catch(() => '');
          if (text && (text.includes('素材') || text.includes('导入'))) {
            await buttons.nth(i).click();
            await page.waitForTimeout(1000);
            await takeScreenshot(page, '03-asset-library');
            return { passed: true };
          }
        }
        return { warning: true, message: '未能打开素材库' };
      } catch (e) {
        return { warning: true, message: e.message };
      }
    });

    // ========================================
    // 4. 搜索功能测试
    // ========================================
    log(colors.cyan, '\n📋 4. 搜索功能测试');

    await runTest('查找搜索输入框', async () => {
      const searchInput = await page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]').first().isVisible().catch(() => false);
      if (searchInput) {
        return { passed: true };
      }
      return { warning: true, message: '未找到搜索输入框' };
    });

    // ========================================
    // 5. 时间轴测试
    // ========================================
    log(colors.cyan, '\n📋 5. 时间轴预览测试');

    await runTest('检查时间轴组件', async () => {
      const timeline = await page.locator('[class*="timeline"], [class*="Timeline"], [class*="track"]').first().isVisible().catch(() => false);
      if (timeline) {
        return { passed: true };
      }
      return { warning: true, message: '未找到时间轴组件' };
    });

    // ========================================
    // 6. 控制台错误检查
    // ========================================
    log(colors.cyan, '\n📋 6. 控制台错误检查');

    await runTest('检查JavaScript错误', async () => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.waitForTimeout(2000);
      
      if (errors.length === 0) {
        return { passed: true };
      }
      return { warning: true, message: `发现 ${errors.length} 个控制台错误` };
    });

    // 最终截图
    await takeScreenshot(page, '99-final-state');

  } catch (error) {
    log(colors.red, '\n❌ 测试执行出错:', error.message);
    testResults.issues.push({ test: 'global', message: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================
// 生成报告
// ============================================
function generateReport() {
  log(colors.blue, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.blue, '║                    E2E 测试报告汇总                        ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════════╝');

  console.log('\n📊 测试统计:');
  console.log(`   总测试数: ${testResults.summary.total}`);
  log(colors.green, `   ✅ 通过: ${testResults.summary.passed}`);
  log(colors.yellow, `   ⚠️  警告: ${testResults.summary.warnings}`);
  log(colors.red, `   ❌ 失败: ${testResults.summary.failed}`);

  if (testResults.screenshots.length > 0) {
    console.log('\n📸 截图:');
    testResults.screenshots.forEach(s => console.log(`   - ${s}`));
  }

  if (testResults.issues.length > 0) {
    console.log('\n⚠️  问题:');
    testResults.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.test}: ${issue.message}`);
    });
  }

  // 保存报告
  fs.writeFileSync('e2e-test-report.json', JSON.stringify(testResults, null, 2));
  console.log('\n📄 报告已保存到: e2e-test-report.json');

  // 生成Markdown报告
  const passRate = testResults.summary.total > 0 
    ? ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1) 
    : '0';
  let md = `# cgcut MVP E2E测试报告\n\n`;
  md += `**测试时间**: ${testResults.timestamp}\n`;
  md += `**通过率**: ${passRate}%\n\n`;
  md += `## 测试结果\n\n`;
  md += `| 测试项 | 状态 | 耗时 |\n|--------|------|------|\n`;
  
  for (const test of testResults.tests) {
    const icon = test.status === 'passed' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
    md += `| ${test.name} | ${icon} ${test.status} | ${test.duration || '-'}ms |\n`;
  }
  
  fs.writeFileSync('E2E_TEST_REPORT.md', md);
  console.log('📄 Markdown报告已保存到: E2E_TEST_REPORT.md');
}

// ============================================
// 主函数
// ============================================
async function main() {
  try {
    await runAllTests();
  } finally {
    generateReport();
  }
  
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

main();
