/**
 * cgcut 前端完整用户流程测试
 * 模拟真实用户操作，验证所有前端功能
 */

import { chromium } from 'playwright';
import fs from 'fs';

const CONFIG = {
  FRONTEND_URL: 'http://localhost:5173',
  CHROME_PATH: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
};

const TEST_SCRIPT = `INT. 办公室 - 白天

王晓坐在办公桌前，眼神紧张地看着电脑屏幕。她的手指在键盘上快速敲打着。

突然，电脑屏幕闪了一下。王晓猛地站起身来。

王晓：不可能...这个数据怎么会消失？`;

const results = {
  timestamp: new Date().toISOString(),
  summary: { total: 0, passed: 0, failed: 0 },
  tests: [],
  errors: [],
  screenshots: [],
};

const log = (icon, msg) => console.log(`${icon} ${msg}`);

async function test(name, fn) {
  results.summary.total++;
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    if (result.success) {
      results.summary.passed++;
      results.tests.push({ name, status: 'passed', duration, detail: result.detail });
      log('✅', `${name} (${duration}ms)${result.detail ? ' - ' + result.detail : ''}`);
    } else {
      results.summary.failed++;
      results.tests.push({ name, status: 'failed', duration, error: result.error, detail: result.detail });
      results.errors.push({ test: name, error: result.error, detail: result.detail });
      log('❌', `${name}: ${result.error}`);
      if (result.detail) log('   ', `详情: ${result.detail}`);
    }
    return result;
  } catch (e) {
    const duration = Date.now() - start;
    results.summary.failed++;
    results.tests.push({ name, status: 'failed', duration, error: e.message });
    results.errors.push({ test: name, error: e.message });
    log('❌', `${name}: ${e.message}`);
    return { success: false, error: e.message };
  }
}

async function screenshot(page, name) {
  const dir = './tests/screenshots';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const path = `${dir}/${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true });
  results.screenshots.push(path);
  return path;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('     cgcut 前端完整用户流程测试');
  console.log('     ' + new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(60));

  let browser;
  let page;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: CONFIG.CHROME_PATH,
    });
    
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    page = await context.newPage();

    // 收集错误
    const jsErrors = [];
    const networkErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });
    page.on('pageerror', err => jsErrors.push(err.message));
    page.on('requestfailed', req => networkErrors.push(`${req.url()} - ${req.failure()?.errorText}`));

    // ==================== 1. 页面加载 ====================
    log('📋', '\n=== 1. 页面加载测试 ===\n');

    await test('页面加载', async () => {
      const res = await page.goto(CONFIG.FRONTEND_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await screenshot(page, '01-initial-load');
      if (res.status() === 200) {
        return { success: true, detail: `HTTP ${res.status()}` };
      }
      return { success: false, error: `HTTP ${res.status()}` };
    });

    await test('页面标题正确', async () => {
      const title = await page.title();
      if (title.includes('cgcut')) {
        return { success: true, detail: title };
      }
      return { success: false, error: `标题不正确: ${title}` };
    });

    // ==================== 2. 剧本输入流程 ====================
    log('📋', '\n=== 2. 剧本输入流程测试 ===\n');

    await test('找到导入剧本按钮', async () => {
      const btn = await page.locator('button:has-text("导入剧本")').first();
      if (await btn.isVisible()) {
        return { success: true, detail: '按钮可见' };
      }
      return { success: false, error: '未找到导入剧本按钮' };
    });

    await test('点击导入剧本按钮', async () => {
      await page.locator('button:has-text("导入剧本")').first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '02-import-dialog');
      
      // 检查是否弹出对话框或输入区域
      const hasDialog = await page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]').first().isVisible().catch(() => false);
      const hasTextarea = await page.locator('textarea').first().isVisible().catch(() => false);
      
      if (hasDialog || hasTextarea) {
        return { success: true, detail: hasDialog ? '对话框已打开' : '输入区域可见' };
      }
      return { success: false, error: '点击后无响应' };
    });

    await test('输入剧本内容', async () => {
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible()) {
        await textarea.fill(TEST_SCRIPT);
        await page.waitForTimeout(300);
        const value = await textarea.inputValue();
        if (value.length > 50) {
          return { success: true, detail: `输入${value.length}字符` };
        }
        return { success: false, error: '内容未正确输入' };
      }
      return { success: false, error: '未找到textarea' };
    });

    await test('找到分析/确认按钮', async () => {
      const confirmBtn = await page.locator('button:has-text("确"), button:has-text("分析"), button:has-text("开始"), button:has-text("导入")').first();
      if (await confirmBtn.isVisible()) {
        const text = await confirmBtn.textContent();
        return { success: true, detail: `找到按钮: ${text}` };
      }
      return { success: false, error: '未找到确认按钮' };
    });

    // ==================== 3. LLM分析流程 ====================
    log('📋', '\n=== 3. LLM分析流程测试 ===\n');

    let analysisStarted = false;
    await test('触发LLM分析', async () => {
      // 点击确认/分析按钮
      const btns = ['确认导入', '确定', '分析', '开始分析', '导入'];
      for (const text of btns) {
        const btn = page.locator(`button:has-text("${text}")`).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          analysisStarted = true;
          await page.waitForTimeout(1000);
          await screenshot(page, '03-analysis-started');
          return { success: true, detail: `点击了"${text}"按钮` };
        }
      }
      return { success: false, error: '未找到可点击的分析按钮' };
    });

    if (analysisStarted) {
      await test('等待LLM分析完成', async () => {
        // 等待加载指示器消失或结果出现
        const maxWait = 90000; // 90秒超时
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          // 检查是否有加载中的指示
          const loading = await page.locator('[class*="loading"], [class*="spinner"], text="分析中"').first().isVisible().catch(() => false);
          
          // 检查是否有错误弹窗
          const errorDialog = await page.locator('text="失败", text="错误", text="error"').first().isVisible().catch(() => false);
          if (errorDialog) {
            const errorText = await page.locator('[role="dialog"], [class*="modal"]').first().textContent().catch(() => '');
            return { success: false, error: '分析失败', detail: errorText.substring(0, 200) };
          }
          
          // 检查是否有分镜结果
          const hasBlocks = await page.locator('[class*="block"], [class*="shot"], [class*="scene"]').count() > 2;
          if (hasBlocks && !loading) {
            await screenshot(page, '04-analysis-complete');
            return { success: true, detail: '分镜结果已生成' };
          }
          
          await page.waitForTimeout(2000);
        }
        
        return { success: false, error: '分析超时(90秒)' };
      });
    }

    // ==================== 4. 素材库功能 ====================
    log('📋', '\n=== 4. 素材库功能测试 ===\n');

    await test('查找素材库入口', async () => {
      const assetBtn = await page.locator('button:has-text("素材"), button:has-text("资源"), [class*="asset"]').first();
      if (await assetBtn.isVisible().catch(() => false)) {
        return { success: true, detail: '素材库入口存在' };
      }
      // 也可能在侧边栏
      const sidebar = await page.locator('[class*="sidebar"], [class*="panel"]').first();
      if (await sidebar.isVisible().catch(() => false)) {
        return { success: true, detail: '侧边栏存在' };
      }
      return { success: false, error: '未找到素材库入口' };
    });

    // ==================== 5. 时间轴功能 ====================
    log('📋', '\n=== 5. 时间轴功能测试 ===\n');

    await test('时间轴组件存在', async () => {
      const timeline = await page.locator('[class*="timeline"], [class*="Timeline"], [class*="track"]').first();
      if (await timeline.isVisible().catch(() => false)) {
        return { success: true, detail: '时间轴可见' };
      }
      return { success: false, error: '未找到时间轴组件', detail: '可能需要先完成分析' };
    });

    // ==================== 6. 拖拽功能 ====================
    log('📋', '\n=== 6. 拖拽排序功能测试 ===\n');

    await test('可拖拽元素存在', async () => {
      const draggables = await page.locator('[draggable="true"], [class*="draggable"], [class*="sortable"]').count();
      if (draggables > 0) {
        return { success: true, detail: `${draggables}个可拖拽元素` };
      }
      return { success: false, error: '未找到可拖拽元素', detail: '可能需要先有分镜数据' };
    });

    // ==================== 7. 错误检查 ====================
    log('📋', '\n=== 7. 错误检查 ===\n');

    await test('无严重JS错误', async () => {
      const criticalErrors = jsErrors.filter(e => 
        !e.includes('favicon') && 
        !e.includes('404') &&
        !e.includes('net::ERR')
      );
      if (criticalErrors.length === 0) {
        return { success: true, detail: '无JS错误' };
      }
      return { success: false, error: `${criticalErrors.length}个JS错误`, detail: criticalErrors.slice(0, 2).join('; ') };
    });

    await test('无关键网络错误', async () => {
      const criticalNetErrors = networkErrors.filter(e => 
        e.includes('localhost:5173') && !e.includes('favicon')
      );
      if (criticalNetErrors.length === 0) {
        return { success: true };
      }
      return { success: false, error: `${criticalNetErrors.length}个网络错误`, detail: criticalNetErrors[0] };
    });

    // 最终截图
    await screenshot(page, '99-final-state');

  } catch (e) {
    log('❌', `测试执行错误: ${e.message}`);
    results.errors.push({ test: '全局', error: e.message });
  } finally {
    if (browser) await browser.close();
  }

  // 生成报告
  generateReport();
}

function generateReport() {
  const passRate = results.summary.total > 0 
    ? ((results.summary.passed / results.summary.total) * 100).toFixed(1)
    : 0;

  console.log('\n' + '='.repeat(60));
  console.log('              前端流程测试报告');
  console.log('='.repeat(60));
  console.log(`\n📊 测试结果: ${results.summary.passed}/${results.summary.total} 通过 (${passRate}%)`);
  console.log(`   ✅ 通过: ${results.summary.passed}`);
  console.log(`   ❌ 失败: ${results.summary.failed}`);

  if (results.errors.length > 0) {
    console.log('\n⚠️  失败详情:');
    results.errors.forEach((e, i) => {
      console.log(`   ${i + 1}. [${e.test}] ${e.error}`);
      if (e.detail) console.log(`      ${e.detail}`);
    });
  }

  if (results.screenshots.length > 0) {
    console.log('\n📸 截图:');
    results.screenshots.forEach(s => console.log(`   ${s}`));
  }

  // 保存报告
  fs.writeFileSync('tests/frontend-flow-report.json', JSON.stringify(results, null, 2));

  let md = `# cgcut 前端用户流程测试报告\n\n`;
  md += `**测试时间**: ${results.timestamp}\n`;
  md += `**通过率**: ${passRate}% (${results.summary.passed}/${results.summary.total})\n\n`;
  md += `## 测试结果\n\n`;
  md += `| 测试项 | 状态 | 耗时 | 详情 |\n`;
  md += `|--------|------|------|------|\n`;
  
  for (const t of results.tests) {
    const icon = t.status === 'passed' ? '✅' : '❌';
    const info = t.status === 'passed' ? (t.detail || '-') : t.error;
    md += `| ${t.name} | ${icon} | ${t.duration}ms | ${info} |\n`;
  }

  if (results.errors.length > 0) {
    md += `\n## ❌ 失败原因\n\n`;
    results.errors.forEach((e, i) => {
      md += `### ${i + 1}. ${e.test}\n`;
      md += `- **错误**: ${e.error}\n`;
      if (e.detail) md += `- **详情**: ${e.detail}\n`;
      md += '\n';
    });
  }

  md += `\n## 📸 截图\n\n`;
  results.screenshots.forEach(s => md += `- ${s}\n`);

  fs.writeFileSync('docs/FRONTEND_FLOW_TEST_REPORT.md', md);
  console.log('\n📄 报告已保存: docs/FRONTEND_FLOW_TEST_REPORT.md');
}

main().catch(console.error);
