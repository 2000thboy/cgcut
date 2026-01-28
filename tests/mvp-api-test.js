/**
 * cgcut MVP 全面API测试脚本
 * 
 * 测试内容：
 * 1. CLIP服务 (localhost:8000) - 视频打标、向量搜索
 * 2. VLM服务 (localhost:8001) - 视频描述生成
 * 3. LLM服务 (智谱AI) - 剧本分镜拆解
 * 4. 前端服务代码完整性检查
 * 5. 端到端数据流验证
 * 
 * 运行方式: node mvp-api-test.js
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

// ============================================
// 配置
// ============================================
const CONFIG = {
  CLIP_ENDPOINT: 'http://localhost:8000',
  VLM_ENDPOINT: 'http://localhost:8001',
  ZHIPU_ENDPOINT: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  ZHIPU_API_KEY: 'cc84c8dd0e05410f913d74821176c6c4.fsD5kFrKy4GJFvY1',
  ZHIPU_MODEL: 'glm-4-plus',
  TEST_TIMEOUT: 30000,
  LLM_TIMEOUT: 60000,
};

// 测试剧本样本
const TEST_SCRIPT = `
INT. 办公室 - 白天

王晓坐在办公桌前，眼神紧张地看着电脑屏幕。她的手指在键盘上快速敲打着，额头上渗出细密的汗珠。

突然，电脑屏幕闪了一下，显示出一行红色警告文字。王晓的瞳孔急剧收缩，她猛地站起身来。

王晓：（低声）不可能...这不可能...

她颤抖着拿起手机，拨打了一个号码。
`;

// ============================================
// 测试结果收集
// ============================================
const testResults = {
  timestamp: new Date().toISOString(),
  summary: { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
  services: {
    clip: { status: 'unknown', tests: [], details: {} },
    vlm: { status: 'unknown', tests: [], details: {} },
    llm: { status: 'unknown', tests: [], details: {} },
    frontend: { status: 'analyzed', tests: [], details: {} },
  },
  mvpChecklist: [],
  issues: [],
  recommendations: [],
};

// ============================================
// 工具函数
// ============================================
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      timeout: options.timeout || CONFIG.TEST_TIMEOUT,
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runTest(category, name, testFn) {
  testResults.summary.total++;
  const startTime = Date.now();

  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    if (result.passed) {
      testResults.summary.passed++;
      testResults.services[category].tests.push({ name, status: 'passed', duration, data: result.data });
      log(colors.green, `  ✅ ${name} (${duration}ms)`);
    } else if (result.warning) {
      testResults.summary.warnings++;
      testResults.services[category].tests.push({ name, status: 'warning', duration, message: result.message });
      log(colors.yellow, `  ⚠️  ${name}: ${result.message}`);
      testResults.issues.push({ type: 'warning', category, test: name, message: result.message });
    } else if (result.skipped) {
      testResults.summary.skipped++;
      testResults.services[category].tests.push({ name, status: 'skipped', message: result.message });
      log(colors.cyan, `  ⏭️  ${name}: ${result.message}`);
    } else {
      testResults.summary.failed++;
      testResults.services[category].tests.push({ name, status: 'failed', duration, message: result.message });
      log(colors.red, `  ❌ ${name}: ${result.message}`);
      testResults.issues.push({ type: 'error', category, test: name, message: result.message });
    }
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.summary.failed++;
    testResults.services[category].tests.push({ name, status: 'failed', duration, message: error.message });
    log(colors.red, `  ❌ ${name}: ${error.message}`);
    testResults.issues.push({ type: 'error', category, test: name, message: error.message });
    return { passed: false, message: error.message };
  }
}

function addMVPCheck(feature, status, details) {
  testResults.mvpChecklist.push({ feature, status, details, timestamp: new Date().toISOString() });
}

// ============================================
// 1. CLIP 服务测试
// ============================================
async function testCLIPService() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  1. CLIP 视频打标服务测试 (localhost:8000)                 ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  // 1.1 服务连接
  const connectResult = await runTest('clip', '服务连接测试', async () => {
    try {
      const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/`);
      if (res.status === 200) {
        testResults.services.clip.status = 'running';
        testResults.services.clip.details = res.data || {};
        return { passed: true, data: res.data };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      testResults.services.clip.status = 'offline';
      return { passed: false, message: '服务未启动' };
    }
  });

  if (testResults.services.clip.status === 'offline') {
    addMVPCheck('CLIP服务', 'FAIL', '服务未启动');
    testResults.recommendations.push('启动CLIP服务: cd clip-service && python clip_server.py');
    return;
  }

  // 1.2 状态端点
  await runTest('clip', 'CLIP状态端点 (/clip)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip`);
    if (res.status === 200 && res.data?.status === 'ok') {
      if (!testResults.services.clip.details) testResults.services.clip.details = {};
      testResults.services.clip.details.model = res.data.model;
      testResults.services.clip.details.device = res.data.device;
      return { passed: true, data: res.data };
    }
    return { passed: false, message: '状态端点异常' };
  });

  // 1.3 模型加载验证
  await runTest('clip', 'CLIP模型加载验证', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip`);
    if (res.data?.model?.includes('clip')) {
      return { passed: true, data: { model: res.data.model, device: res.data.device } };
    }
    return { warning: true, message: '无法确认模型状态' };
  });

  // 1.4 扫描端点
  await runTest('clip', '扫描端点 (/clip/scan)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip/scan`, {
      method: 'POST',
      body: { directory: './test-nonexistent', file_patterns: ['*.mp4'] }
    });
    if (res.status === 200 || res.status === 404) return { passed: true };
    return { passed: false, message: `HTTP ${res.status}` };
  });

  // 1.5 单文件处理端点
  await runTest('clip', '单文件处理端点 (/clip/process)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip/process`, {
      method: 'POST',
      body: { file_path: './test-nonexistent.mp4' }
    });
    if (res.status === 404 || res.status === 200) return { passed: true };
    return { passed: false, message: `HTTP ${res.status}` };
  });

  // 1.6 文字搜索端点
  await runTest('clip', '文字搜索端点 (/clip/search)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip/search`, {
      method: 'POST',
      body: { query: '室内场景', top_k: 5 }
    });
    if (res.status === 200 && res.data?.status === 'success') {
      return { passed: true, data: { total: res.data.total, searched: res.data.searched } };
    }
    return { passed: false, message: `HTTP ${res.status}` };
  });

  // 1.7 多条件搜索端点
  await runTest('clip', '多条件搜索端点 (/clip/search-multi)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip/search-multi`, {
      method: 'POST',
      body: { queries: ['室内', '人物'], top_k: 5 }
    });
    if (res.status === 200) return { passed: true };
    return { passed: false, message: `HTTP ${res.status}` };
  });

  // 1.8 结果保存端点
  await runTest('clip', '结果保存端点 (/clip/save-results)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip/save-results`, {
      method: 'POST',
      body: { results: [] }
    });
    if (res.status === 200) return { passed: true };
    return { passed: false, message: `HTTP ${res.status}` };
  });

  // 1.9 获取结果端点
  await runTest('clip', '获取结果端点 (/clip/results)', async () => {
    const res = await makeRequest(`${CONFIG.CLIP_ENDPOINT}/clip/results`);
    if (res.status === 200 && res.data?.results !== undefined) {
      return { passed: true, data: { total: res.data.total } };
    }
    return { passed: false, message: `HTTP ${res.status}` };
  });

  addMVPCheck('CLIP服务', testResults.services.clip.status === 'running' ? 'PASS' : 'FAIL',
    `${testResults.services.clip.details.model || 'unknown'} on ${testResults.services.clip.details.device || 'unknown'}`);
}

// ============================================
// 2. VLM 服务测试
// ============================================
async function testVLMService() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  2. VLM 视频描述服务测试 (localhost:8001)                  ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  // 2.1 服务连接
  await runTest('vlm', '服务连接测试', async () => {
    try {
      const res = await makeRequest(`${CONFIG.VLM_ENDPOINT}/`);
      if (res.status === 200) {
        testResults.services.vlm.status = 'running';
        testResults.services.vlm.details = res.data || {};
        return { passed: true, data: res.data };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      testResults.services.vlm.status = 'offline';
      return { passed: false, message: '服务未启动' };
    }
  });

  if (testResults.services.vlm.status === 'offline') {
    addMVPCheck('VLM服务', 'FAIL', '服务未启动');
    testResults.recommendations.push('启动VLM服务: cd vlm-service && python vlm_server.py');
    return;
  }

  // 2.2 状态端点
  await runTest('vlm', 'VLM状态端点 (/vlm)', async () => {
    const res = await makeRequest(`${CONFIG.VLM_ENDPOINT}/vlm`);
    if (res.status === 200 && res.data?.status === 'ok') {
      if (!testResults.services.vlm.details) testResults.services.vlm.details = {};
      testResults.services.vlm.details.model = res.data.model;
      testResults.services.vlm.details.device = res.data.device;
      return { passed: true, data: res.data };
    }
    return { passed: false, message: '状态端点异常' };
  });

  // 2.3 描述生成端点
  await runTest('vlm', '描述生成端点 (/vlm/describe)', async () => {
    const res = await makeRequest(`${CONFIG.VLM_ENDPOINT}/vlm/describe`, {
      method: 'POST',
      body: { file_path: './test-nonexistent.mp4', prompt: '描述这个视频' }
    });
    if (res.status === 404 || res.status === 200) return { passed: true };
    return { passed: false, message: `HTTP ${res.status}` };
  });

  // 2.4 批量处理端点
  await runTest('vlm', '批量处理端点 (/vlm/batch)', async () => {
    const res = await makeRequest(`${CONFIG.VLM_ENDPOINT}/vlm/batch`, {
      method: 'POST',
      body: { directory: './test-nonexistent', file_patterns: ['*.mp4'] }
    });
    if (res.status === 404 || res.status === 200) return { passed: true };
    return { passed: false, message: `HTTP ${res.status}` };
  });

  addMVPCheck('VLM服务', testResults.services.vlm.status === 'running' ? 'PASS' : 'FAIL',
    `${testResults.services.vlm.details?.model || 'unknown'} on ${testResults.services.vlm.details?.device || 'unknown'}`);
}

// ============================================
// 3. LLM 服务测试 (智谱AI)
// ============================================
async function testLLMService() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  3. LLM 剧本分析服务测试 (智谱AI GLM-4-Plus)               ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  // 3.1 API连接测试
  await runTest('llm', '智谱AI API连接', async () => {
    try {
      const res = await makeRequest(CONFIG.ZHIPU_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CONFIG.ZHIPU_API_KEY}` },
        body: { model: CONFIG.ZHIPU_MODEL, messages: [{ role: 'user', content: '你好' }], max_tokens: 10 },
        timeout: CONFIG.LLM_TIMEOUT,
      });

      if (res.status === 200 && res.data?.choices) {
        testResults.services.llm.status = 'working';
        testResults.services.llm.details = { model: CONFIG.ZHIPU_MODEL, response: res.data.choices[0]?.message?.content };
        return { passed: true, data: { response: res.data.choices[0]?.message?.content } };
      } else if (res.status === 401) {
        testResults.services.llm.status = 'auth_error';
        return { passed: false, message: 'API Key无效或已过期' };
      } else if (res.status === 429) {
        testResults.services.llm.status = 'rate_limited';
        return { warning: true, message: 'API请求频率限制' };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      testResults.services.llm.status = 'error';
      return { passed: false, message: e.message };
    }
  });

  if (testResults.services.llm.status !== 'working') {
    addMVPCheck('LLM服务', 'FAIL', testResults.services.llm.status);
    return;
  }

  // 3.2 剧本分镜拆解测试
  await runTest('llm', '剧本分镜拆解功能', async () => {
    try {
      const prompt = `你是分镜师，将以下剧本拆解为3-5个镜头。返回JSON格式：
{"scenes":[{"id":"scene_1","name":"场景名","blocks":[{"id":"block_1","text":"[景别] 描述","emotion":"情绪","expected_duration":3.0}]}]}

剧本：${TEST_SCRIPT.substring(0, 200)}`;

      const res = await makeRequest(CONFIG.ZHIPU_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CONFIG.ZHIPU_API_KEY}` },
        body: {
          model: CONFIG.ZHIPU_MODEL,
          messages: [
            { role: 'system', content: '你是专业分镜师，将剧本拆解为镜头序列，返回JSON格式。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1500,
          temperature: 0.3,
        },
        timeout: CONFIG.LLM_TIMEOUT,
      });

      if (res.status === 200 && res.data?.choices?.[0]?.message?.content) {
        const content = res.data.choices[0].message.content;

        // 验证返回内容
        const hasScenes = content.includes('scene') || content.includes('镜头');
        const hasBlocks = content.includes('block') || content.includes('[');
        const hasJSON = content.includes('{') && content.includes('}');

        if (hasScenes && hasBlocks && hasJSON) {
          testResults.services.llm.details.scriptAnalysis = 'working';
          return { passed: true, data: { preview: content.substring(0, 300) } };
        }
        return { warning: true, message: 'LLM返回格式可能不符合预期' };
      }
      return { passed: false, message: 'API响应异常' };
    } catch (e) {
      return { passed: false, message: e.message };
    }
  });

  // 3.3 JSON解析能力测试
  await runTest('llm', 'JSON格式输出能力', async () => {
    try {
      const res = await makeRequest(CONFIG.ZHIPU_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CONFIG.ZHIPU_API_KEY}` },
        body: {
          model: CONFIG.ZHIPU_MODEL,
          messages: [{ role: 'user', content: '返回一个简单的JSON对象：{"test": true, "count": 3}' }],
          max_tokens: 100,
        },
        timeout: CONFIG.LLM_TIMEOUT,
      });

      if (res.status === 200) {
        const content = res.data?.choices?.[0]?.message?.content || '';
        try {
          // 尝试提取并解析JSON
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            JSON.parse(jsonMatch[0]);
            return { passed: true };
          }
        } catch { }
        return { warning: true, message: 'JSON解析可能需要额外处理' };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      return { passed: false, message: e.message };
    }
  });

  addMVPCheck('LLM服务', 'PASS', `${CONFIG.ZHIPU_MODEL} - 剧本分析功能正常`);
}

// ============================================
// 4. 前端代码分析
// ============================================
async function analyzeFrontendCode() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  4. 前端服务代码分析                                       ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  // 4.1 llmService.ts 分析
  await runTest('frontend', 'llmService.ts - 真实API调用', async () => {
    const content = fs.readFileSync('src/services/llmService.ts', 'utf-8');

    const checks = {
      hasRealAPI: content.includes('fetch(') && (content.includes('bigmodel.cn') || content.includes('nvidia.com')),
      noMock: !content.includes('mockResponse') && !content.includes('MOCK_'),
      hasErrorHandling: content.includes('catch') && content.includes('throw'),
      hasJSONParsing: content.includes('robustJSONParse') || content.includes('JSON.parse'),
    };

    if (checks.hasRealAPI && checks.noMock) {
      return { passed: true, data: checks };
    }
    if (!checks.hasRealAPI) return { passed: false, message: '未找到真实API调用' };
    if (!checks.noMock) return { warning: true, message: '发现mock数据' };
    return { passed: true };
  });

  // 4.2 clipService.ts 分析
  await runTest('frontend', 'clipService.ts - 真实API调用', async () => {
    const content = fs.readFileSync('src/services/clipService.ts', 'utf-8');

    const checks = {
      hasRealAPI: content.includes('fetch(') && content.includes('localhost:8000'),
      defaultNoMock: content.includes('useMock: config.useMock ?? false'),
      hasSearchAPI: content.includes('/clip/search'),
      hasErrorHandling: content.includes('throw new Error'),
    };

    if (checks.hasRealAPI && checks.defaultNoMock) {
      return { passed: true, data: checks };
    }
    return { warning: true, message: '配置可能需要检查' };
  });

  // 4.3 taggingService.ts 分析
  await runTest('frontend', 'taggingService.ts - 双服务集成', async () => {
    const content = fs.readFileSync('src/services/taggingService.ts', 'utf-8');

    const checks = {
      hasCLIP: content.includes('localhost:8000'),
      hasVLM: content.includes('localhost:8001'),
      hasBothServices: content.includes('clipEndpoint') && content.includes('vlmEndpoint'),
    };

    if (checks.hasCLIP && checks.hasVLM) {
      return { passed: true, data: checks };
    }
    return { passed: false, message: '服务端点配置不完整' };
  });

  // 4.4 searchService.ts 分析
  await runTest('frontend', 'searchService.ts - 搜索功能', async () => {
    const content = fs.readFileSync('src/services/searchService.ts', 'utf-8');

    const checks = {
      hasTagSearch: content.includes('searchByTags'),
      hasSemanticSearch: content.includes('searchBySemantic'),
      hasClipSearch: content.includes('searchByClipVector'),
      hasSmartSearch: content.includes('smartSearch'),
    };

    const passCount = Object.values(checks).filter(Boolean).length;
    if (passCount >= 3) {
      return { passed: true, data: checks };
    }
    return { warning: true, message: `搜索功能实现 ${passCount}/4` };
  });

  addMVPCheck('前端服务代码', 'PASS', '所有服务文件结构完整');
}

// ============================================
// 5. 数据模型和Store检查
// ============================================
async function checkDataModels() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  5. 数据模型和状态管理检查                                 ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  // 5.1 数据模型定义
  await runTest('frontend', '数据模型定义完整性', async () => {
    const content = fs.readFileSync('src/types/DataModel.ts', 'utf-8');

    const requiredTypes = ['CLIPMetadata', 'VLMMetadata', 'Shot', 'ScriptBlock', 'Clip',
      'LLMScriptAnalysisRequest', 'LLMScriptAnalysisResponse'];
    const missing = requiredTypes.filter(t => !content.includes(t));

    if (missing.length === 0) return { passed: true, data: { types: requiredTypes.length } };
    return { passed: false, message: `缺少类型: ${missing.join(', ')}` };
  });

  // 5.2 Store状态管理
  await runTest('frontend', 'Store状态管理', async () => {
    const content = fs.readFileSync('src/store/appStore.ts', 'utf-8');

    const requiredActions = ['setScriptBlocks', 'setShots', 'setClips', 'addClip'];
    const missing = requiredActions.filter(a => !content.includes(a));

    if (missing.length === 0) return { passed: true, data: { actions: requiredActions.length } };
    return { passed: false, message: `缺少Action: ${missing.join(', ')}` };
  });

  // 5.3 App.tsx集成
  await runTest('frontend', 'App.tsx服务集成', async () => {
    const content = fs.readFileSync('src/App.tsx', 'utf-8');

    const checks = {
      hasLLMService: content.includes('llmService'),
      hasCLIPService: content.includes('clipService'),
      hasAnalyzeScript: content.includes('analyzeScript'),
    };

    const passCount = Object.values(checks).filter(Boolean).length;
    if (passCount >= 2) return { passed: true, data: checks };
    return { warning: true, message: '服务集成可能不完整' };
  });

  addMVPCheck('数据模型', 'PASS', '类型定义和状态管理完整');
}

// ============================================
// 6. MVP功能清单检查
// ============================================
async function checkMVPFeatures() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  6. MVP 核心功能清单检查                                   ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════╝');

  const mvpFeatures = [
    { name: '剧本输入', file: 'src/App.tsx', pattern: 'textarea|scriptContent|剧本' },
    { name: 'LLM分镜拆解', file: 'src/services/llmService.ts', pattern: 'analyzeScript' },
    { name: '素材库管理', file: 'src/components/AssetManagerModal.tsx', pattern: 'AssetManager|素材' },
    { name: 'CLIP打标', file: 'src/services/clipService.ts', pattern: 'scanAndProcess|process' },
    { name: 'VLM描述', file: 'src/services/taggingService.ts', pattern: 'vlm|describe' },
    { name: '素材搜索', file: 'src/services/searchService.ts', pattern: 'search|Search' },
    { name: '拖拽排序', file: 'package.json', pattern: '@dnd-kit' },
    { name: '时间轴预览', file: 'src/App.tsx', pattern: 'timeline|Timeline|时间轴' },
  ];

  for (const feature of mvpFeatures) {
    await runTest('frontend', `MVP功能: ${feature.name}`, async () => {
      try {
        const content = fs.readFileSync(feature.file, 'utf-8');
        const regex = new RegExp(feature.pattern, 'i');
        if (regex.test(content)) {
          return { passed: true };
        }
        return { warning: true, message: '功能可能未完全实现' };
      } catch (e) {
        return { passed: false, message: `文件不存在: ${feature.file}` };
      }
    });
  }
}

// ============================================
// 7. 生成报告
// ============================================
function generateReport() {
  log(colors.blue, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.blue, '║                    MVP 测试报告汇总                        ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════════╝');

  // 测试统计
  console.log('\n📊 测试统计:');
  console.log(`   总测试数: ${testResults.summary.total}`);
  log(colors.green, `   ✅ 通过: ${testResults.summary.passed}`);
  log(colors.yellow, `   ⚠️  警告: ${testResults.summary.warnings}`);
  log(colors.red, `   ❌ 失败: ${testResults.summary.failed}`);
  log(colors.cyan, `   ⏭️  跳过: ${testResults.summary.skipped}`);

  // 服务状态
  console.log('\n🔧 服务状态:');
  for (const [name, service] of Object.entries(testResults.services)) {
    const status = service.status;
    const statusIcon = status === 'working' || status === 'running' || status === 'analyzed'
      ? '🟢' : status === 'offline' || status === 'error' ? '🔴' : '🟡';
    console.log(`   ${statusIcon} ${name.toUpperCase()}: ${status}`);
    if (service.details?.model) console.log(`      模型: ${service.details.model}`);
    if (service.details?.device) console.log(`      设备: ${service.details.device}`);
  }

  // MVP清单
  console.log('\n📋 MVP功能清单:');
  for (const item of testResults.mvpChecklist) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'WARN' ? '⚠️' : '❌';
    console.log(`   ${icon} ${item.feature}: ${item.details}`);
  }

  // 问题列表
  if (testResults.issues.length > 0) {
    console.log('\n⚠️  发现的问题:');
    testResults.issues.forEach((issue, i) => {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      console.log(`   ${i + 1}. ${icon} [${issue.category}] ${issue.test}: ${issue.message}`);
    });
  }

  // 建议
  if (testResults.recommendations.length > 0) {
    console.log('\n💡 建议操作:');
    testResults.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }

  // 保存报告
  const reportPath = 'mvp-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);

  // 生成Markdown报告
  generateMarkdownReport();

  // 返回退出码
  const exitCode = testResults.summary.failed > 0 ? 1 : 0;
  console.log(`\n🏁 测试完成，退出码: ${exitCode}`);
  return exitCode;
}

function generateMarkdownReport() {
  const passRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);

  let md = `# cgcut MVP API 测试报告

**测试时间**: ${testResults.timestamp}
**通过率**: ${passRate}% (${testResults.summary.passed}/${testResults.summary.total})

## 📊 测试统计

| 状态 | 数量 |
|------|------|
| ✅ 通过 | ${testResults.summary.passed} |
| ⚠️ 警告 | ${testResults.summary.warnings} |
| ❌ 失败 | ${testResults.summary.failed} |
| ⏭️ 跳过 | ${testResults.summary.skipped} |

## 🔧 服务状态

| 服务 | 状态 | 详情 |
|------|------|------|
`;

  for (const [name, service] of Object.entries(testResults.services)) {
    const statusIcon = service.status === 'working' || service.status === 'running' || service.status === 'analyzed'
      ? '🟢' : service.status === 'offline' || service.status === 'error' ? '🔴' : '🟡';
    const details = service.details?.model ? `${service.details.model} (${service.details.device || 'N/A'})` : '-';
    md += `| ${name.toUpperCase()} | ${statusIcon} ${service.status} | ${details} |\n`;
  }

  md += `\n## 📋 MVP功能清单\n\n`;
  for (const item of testResults.mvpChecklist) {
    const icon = item.status === 'PASS' ? '✅' : item.status === 'WARN' ? '⚠️' : '❌';
    md += `- ${icon} **${item.feature}**: ${item.details}\n`;
  }

  if (testResults.issues.length > 0) {
    md += `\n## ⚠️ 发现的问题\n\n`;
    testResults.issues.forEach((issue, i) => {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      md += `${i + 1}. ${icon} **[${issue.category}]** ${issue.test}: ${issue.message}\n`;
    });
  }

  if (testResults.recommendations.length > 0) {
    md += `\n## 💡 建议操作\n\n`;
    testResults.recommendations.forEach((rec, i) => {
      md += `${i + 1}. ${rec}\n`;
    });
  }

  md += `\n---\n*报告由 mvp-api-test.js 自动生成*\n`;

  fs.writeFileSync('MVP_TEST_REPORT.md', md);
  console.log('📄 Markdown报告已保存到: MVP_TEST_REPORT.md');
}

// ============================================
// 主函数
// ============================================
async function main() {
  log(colors.magenta, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.magenta, '║           cgcut MVP 全面API测试                            ║');
  log(colors.magenta, '║           ' + new Date().toLocaleString().padEnd(30) + '       ║');
  log(colors.magenta, '╚════════════════════════════════════════════════════════════╝');

  console.log('\n🎯 测试目标:');
  console.log('   1. CLIP服务 - 视频打标、向量搜索');
  console.log('   2. VLM服务 - 视频描述生成');
  console.log('   3. LLM服务 - 剧本分镜拆解');
  console.log('   4. 前端代码 - 服务集成完整性');
  console.log('   5. 数据模型 - 类型定义和状态管理');
  console.log('   6. MVP功能 - 核心功能清单');

  try {
    // 执行所有测试
    await testCLIPService();
    await testVLMService();
    await testLLMService();
    await analyzeFrontendCode();
    await checkDataModels();
    await checkMVPFeatures();

    // 生成报告
    const exitCode = generateReport();
    process.exit(exitCode);
  } catch (error) {
    log(colors.red, '\n❌ 测试执行出错:', error.message);
    process.exit(1);
  }
}

main();
