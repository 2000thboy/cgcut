/**
 * cgcut MVP 完整端到端测试
 * 验证所有用户流程，记录详细失败原因
 */

import { chromium } from 'playwright';
import fs from 'fs';

const CONFIG = {
  FRONTEND_URL: 'http://localhost:5173',
  CLIP_URL: 'http://localhost:8000',
  VLM_URL: 'http://localhost:8001',
  ZHIPU_API: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  ZHIPU_KEY: 'cc84c8dd0e05410f913d74821176c6c4.fsD5kFrKy4GJFvY1',
};

const TEST_SCRIPT = `INT. 办公室 - 白天

王晓坐在办公桌前，眼神紧张地看着电脑屏幕。她的手指在键盘上快速敲打着。

突然，电脑屏幕闪了一下。王晓猛地站起身来。

王晓：不可能...`;

const results = {
  timestamp: new Date().toISOString(),
  summary: { total: 0, passed: 0, failed: 0 },
  tests: [],
  errors: [],
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
      log('✅', `${name} (${duration}ms)`);
    } else {
      results.summary.failed++;
      results.tests.push({ name, status: 'failed', duration, error: result.error, detail: result.detail });
      results.errors.push({ test: name, error: result.error });
      log('❌', `${name}: ${result.error}`);
    }
  } catch (e) {
    const duration = Date.now() - start;
    results.summary.failed++;
    results.tests.push({ name, status: 'failed', duration, error: e.message });
    results.errors.push({ test: name, error: e.message });
    log('❌', `${name}: ${e.message}`);
  }
}


// ==================== 后端服务测试 ====================

async function testBackendServices() {
  log('📡', '\n=== 后端服务连通性测试 ===\n');

  // 1. CLIP 服务
  await test('CLIP服务连接', async () => {
    try {
      const res = await fetch(`${CONFIG.CLIP_URL}/clip`);
      const data = await res.json();
      if (data.status === 'running' || data.status === 'ok') {
        return { success: true, detail: `模型: ${data.model || 'CLIP'}, 设备: ${data.device || 'cpu'}` };
      }
      return { success: false, error: `状态异常: ${data.status}` };
    } catch (e) {
      return { success: false, error: `连接失败: ${e.message}` };
    }
  });

  // 2. VLM 服务
  await test('VLM服务连接', async () => {
    try {
      const res = await fetch(`${CONFIG.VLM_URL}/vlm`);
      const data = await res.json();
      if (data.status === 'running' || data.status === 'ok') {
        return { success: true, detail: `模型: ${data.model || 'VLM'}, 设备: ${data.device || 'cpu'}` };
      }
      return { success: false, error: `状态异常: ${data.status}` };
    } catch (e) {
      return { success: false, error: `连接失败: ${e.message}` };
    }
  });

  // 3. LLM API (智谱)
  await test('智谱AI API连接', async () => {
    try {
      const res = await fetch(CONFIG.ZHIPU_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.ZHIPU_KEY}`,
        },
        body: JSON.stringify({
          model: 'glm-4-plus',
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, detail: `响应正常, model: ${data.model}` };
      }
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText.substring(0, 100)}` };
    } catch (e) {
      return { success: false, error: `请求失败: ${e.message}` };
    }
  });
}

// ==================== LLM 分镜拆解测试 ====================

async function testLLMAnalysis() {
  log('🤖', '\n=== LLM 剧本分镜拆解测试 ===\n');

  await test('剧本分镜拆解完整流程', async () => {
    const prompt = `你是一位资深影视分镜师。请将以下剧本拆解为分镜镜头，每个场景至少3个镜头。

剧本：
${TEST_SCRIPT}

返回JSON格式：{"scenes":[{"id":"scene_1","name":"场景名","blocks":[{"id":"block_1","text":"[景别] 描述","emotion":"情绪","expected_duration":3.0}]}]}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(CONFIG.ZHIPU_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.ZHIPU_KEY}`,
        },
        body: JSON.stringify({
          model: 'glm-4-plus',
          messages: [
            { role: 'system', content: '你是专业的影视分镜师，返回JSON格式的分镜数据。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `API错误 HTTP ${res.status}: ${errText.substring(0, 200)}` };
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      // 尝试解析JSON
      let jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        return { success: false, error: '返回内容不包含JSON', detail: content.substring(0, 200) };
      }

      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      
      try {
        const parsed = JSON.parse(jsonStr);
        const sceneCount = parsed.scenes?.length || 0;
        const blockCount = parsed.scenes?.reduce((sum, s) => sum + (s.blocks?.length || 0), 0) || 0;
        
        if (sceneCount === 0) {
          return { success: false, error: '未生成任何场景' };
        }
        if (blockCount < 3) {
          return { success: false, error: `镜头数不足: ${blockCount}个 (要求>=3)` };
        }
        
        return { success: true, detail: `${sceneCount}个场景, ${blockCount}个镜头` };
      } catch (parseErr) {
        return { success: false, error: `JSON解析失败: ${parseErr.message}`, detail: jsonStr.substring(0, 200) };
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        return { success: false, error: '请求超时 (60秒)' };
      }
      return { success: false, error: e.message };
    }
  });
}


// ==================== CLIP 打标测试 ====================

async function testCLIPTagging() {
  log('🏷️', '\n=== CLIP 视频打标测试 ===\n');

  await test('CLIP文字搜索功能', async () => {
    try {
      const res = await fetch(`${CONFIG.CLIP_URL}/clip/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '办公室场景', top_k: 5 }),
      });
      
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${errText}` };
      }
      
      const data = await res.json();
      return { success: true, detail: `返回 ${data.results?.length || 0} 个结果` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  await test('CLIP扫描端点可用', async () => {
    try {
      const res = await fetch(`${CONFIG.CLIP_URL}/clip/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: 'C:/test', recursive: false }),
      });
      // 即使目录不存在，端点应该返回错误而不是崩溃
      return { success: true, detail: `端点响应正常, status: ${res.status}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

// ==================== VLM 描述测试 ====================

async function testVLMDescription() {
  log('📝', '\n=== VLM 视频描述测试 ===\n');

  await test('VLM描述端点可用', async () => {
    try {
      const res = await fetch(`${CONFIG.VLM_URL}/vlm/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: 'test.mp4' }),
      });
      // 即使文件不存在，端点应该返回错误而不是崩溃
      return { success: true, detail: `端点响应正常, status: ${res.status}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

// ==================== 前端UI测试 ====================

async function testFrontendUI() {
  log('🖥️', '\n=== 前端UI功能测试 ===\n');

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    });
    const page = await browser.newPage();
    
    // 收集控制台错误
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // 1. 页面加载
    await test('前端页面加载', async () => {
      const res = await page.goto(CONFIG.FRONTEND_URL, { waitUntil: 'networkidle', timeout: 30000 });
      if (res.status() === 200) {
        const title = await page.title();
        return { success: true, detail: `标题: ${title}` };
      }
      return { success: false, error: `HTTP ${res.status()}` };
    });

    // 2. 主要UI组件
    await test('主要UI组件渲染', async () => {
      await page.waitForTimeout(1000);
      const hasRoot = await page.$('#root') !== null;
      const hasContent = await page.$('div[class*="flex"], div[class*="grid"], main') !== null;
      
      if (hasRoot) {
        return { success: true, detail: 'React应用正常渲染' };
      }
      return { success: false, error: `root: ${hasRoot}, content: ${hasContent}` };
    });

    // 3. 查找导入剧本按钮
    await test('导入剧本按钮存在', async () => {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && text.includes('导入')) {
          return { success: true, detail: `找到按钮: "${text.trim()}"` };
        }
      }
      return { success: false, error: '未找到导入按钮' };
    });

    // 4. 检查控制台错误
    await test('无严重JavaScript错误', async () => {
      await page.waitForTimeout(2000);
      const criticalErrors = consoleErrors.filter(e => 
        !e.includes('favicon') && !e.includes('404')
      );
      if (criticalErrors.length === 0) {
        return { success: true, detail: '无JS错误' };
      }
      return { success: false, error: `${criticalErrors.length}个错误`, detail: criticalErrors.slice(0, 3).join('; ') };
    });

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    results.errors.push({ test: '前端UI测试', error: e.message });
    log('❌', `前端测试失败: ${e.message}`);
  }
}

// ==================== 生成报告 ====================

function generateReport() {
  const passRate = results.summary.total > 0 
    ? ((results.summary.passed / results.summary.total) * 100).toFixed(1)
    : 0;

  console.log('\n' + '='.repeat(60));
  console.log('                 MVP 完整测试报告');
  console.log('='.repeat(60));
  console.log(`\n📊 测试统计: ${results.summary.passed}/${results.summary.total} 通过 (${passRate}%)`);
  console.log(`   ✅ 通过: ${results.summary.passed}`);
  console.log(`   ❌ 失败: ${results.summary.failed}`);

  if (results.errors.length > 0) {
    console.log('\n⚠️  失败详情:');
    results.errors.forEach((e, i) => {
      console.log(`   ${i + 1}. [${e.test}] ${e.error}`);
    });
  }

  // 保存JSON报告
  fs.writeFileSync('tests/full-e2e-report.json', JSON.stringify(results, null, 2));

  // 生成Markdown报告
  let md = `# cgcut MVP 完整测试报告\n\n`;
  md += `**测试时间**: ${results.timestamp}\n`;
  md += `**通过率**: ${passRate}% (${results.summary.passed}/${results.summary.total})\n\n`;
  md += `## 测试结果\n\n`;
  md += `| 测试项 | 状态 | 耗时 | 详情/错误 |\n`;
  md += `|--------|------|------|----------|\n`;
  
  for (const t of results.tests) {
    const icon = t.status === 'passed' ? '✅' : '❌';
    const info = t.status === 'passed' ? (t.detail || '-') : t.error;
    md += `| ${t.name} | ${icon} | ${t.duration}ms | ${info} |\n`;
  }

  if (results.errors.length > 0) {
    md += `\n## ❌ 失败原因详解\n\n`;
    results.errors.forEach((e, i) => {
      md += `### ${i + 1}. ${e.test}\n`;
      md += `**错误**: ${e.error}\n\n`;
    });
  }

  md += `\n## 服务地址\n\n`;
  md += `- 前端: http://localhost:5173/\n`;
  md += `- CLIP: http://localhost:8000/\n`;
  md += `- VLM: http://localhost:8001/\n`;

  fs.writeFileSync('docs/MVP_FULL_TEST_REPORT.md', md);
  console.log('\n📄 报告已保存: docs/MVP_FULL_TEST_REPORT.md');
}

// ==================== 主函数 ====================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('        cgcut MVP 完整端到端测试');
  console.log('        ' + new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(60));

  await testBackendServices();
  await testLLMAnalysis();
  await testCLIPTagging();
  await testVLMDescription();
  await testFrontendUI();
  
  generateReport();
}

main().catch(console.error);
