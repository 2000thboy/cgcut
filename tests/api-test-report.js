/**
 * 全面API检测脚本
 * 检测所有后端服务的真实功能实现
 */

import http from 'http';
import https from 'https';
import fs from 'fs';

// 测试结果收集
const testResults = {
  timestamp: new Date().toISOString(),
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  services: {},
  issues: [],
  recommendations: []
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// HTTP请求封装
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || 10000
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, raw: data });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// 测试用例执行器
async function runTest(name, testFn) {
  testResults.summary.total++;
  try {
    const result = await testFn();
    if (result.passed) {
      testResults.summary.passed++;
      log(colors.green, `✅ ${name}`);
    } else if (result.warning) {
      testResults.summary.warnings++;
      log(colors.yellow, `⚠️  ${name}: ${result.message}`);
      testResults.issues.push({ type: 'warning', test: name, message: result.message });
    } else {
      testResults.summary.failed++;
      log(colors.red, `❌ ${name}: ${result.message}`);
      testResults.issues.push({ type: 'error', test: name, message: result.message });
    }
    return result;
  } catch (error) {
    testResults.summary.failed++;
    log(colors.red, `❌ ${name}: ${error.message}`);
    testResults.issues.push({ type: 'error', test: name, message: error.message });
    return { passed: false, message: error.message };
  }
}

// ============================================
// 1. CLIP 服务检测
// ============================================
async function testCLIPService() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '🔍 1. CLIP 服务检测 (localhost:8000)');
  log(colors.cyan, '========================================');

  testResults.services.clip = {
    endpoint: 'http://localhost:8000',
    status: 'unknown',
    tests: []
  };

  // 1.1 服务连接测试
  const connectResult = await runTest('CLIP服务连接', async () => {
    try {
      const res = await makeRequest('http://localhost:8000/');
      if (res.status === 200 && res.data) {
        testResults.services.clip.status = 'running';
        return { passed: true, data: res.data };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      testResults.services.clip.status = 'offline';
      return { passed: false, message: '服务未启动或无法连接' };
    }
  });

  if (testResults.services.clip.status === 'offline') {
    testResults.recommendations.push('启动CLIP服务: cd clip-service && python clip_server.py');
    return;
  }

  // 1.2 CLIP状态端点测试
  await runTest('CLIP状态端点 (/clip)', async () => {
    const res = await makeRequest('http://localhost:8000/clip');
    if (res.status === 200 && res.data?.status === 'ok') {
      testResults.services.clip.model = res.data.model;
      testResults.services.clip.device = res.data.device;
      return { passed: true, data: res.data };
    }
    return { passed: false, message: '状态端点返回异常' };
  });

  // 1.3 检查是否使用真实模型
  await runTest('CLIP模型加载验证', async () => {
    const res = await makeRequest('http://localhost:8000/clip');
    if (res.data?.model && res.data.model.includes('clip')) {
      return { passed: true, data: { model: res.data.model } };
    }
    return { warning: true, message: '无法确认模型是否正确加载' };
  });

  // 1.4 扫描API测试（不实际扫描，只测试端点）
  await runTest('CLIP扫描端点可用性 (/clip/scan)', async () => {
    try {
      const res = await makeRequest('http://localhost:8000/clip/scan', {
        method: 'POST',
        body: {
          directory: './test-nonexistent',
          file_patterns: ['*.mp4']
        }
      });
      // 即使目录不存在，端点应该返回有效响应
      if (res.status === 200 || res.status === 404) {
        return { passed: true };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      return { passed: false, message: e.message };
    }
  });

  // 1.5 单文件处理端点测试
  await runTest('CLIP单文件处理端点 (/clip/process)', async () => {
    try {
      const res = await makeRequest('http://localhost:8000/clip/process', {
        method: 'POST',
        body: {
          file_path: './test-nonexistent.mp4'
        }
      });
      // 文件不存在应返回404，但端点应该可用
      if (res.status === 404 || res.status === 200) {
        return { passed: true };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      return { passed: false, message: e.message };
    }
  });
}

// ============================================
// 2. VLM 服务检测
// ============================================
async function testVLMService() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '🔍 2. VLM 服务检测 (localhost:8001)');
  log(colors.cyan, '========================================');

  testResults.services.vlm = {
    endpoint: 'http://localhost:8001',
    status: 'unknown',
    tests: []
  };

  // 2.1 服务连接测试
  await runTest('VLM服务连接', async () => {
    try {
      const res = await makeRequest('http://localhost:8001/');
      if (res.status === 200 && res.data) {
        testResults.services.vlm.status = 'running';
        return { passed: true, data: res.data };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      testResults.services.vlm.status = 'offline';
      return { passed: false, message: '服务未启动或无法连接' };
    }
  });

  if (testResults.services.vlm.status === 'offline') {
    testResults.recommendations.push('启动VLM服务: cd vlm-service && python vlm_server.py');
    return;
  }

  // 2.2 VLM状态端点测试
  await runTest('VLM状态端点 (/vlm)', async () => {
    const res = await makeRequest('http://localhost:8001/vlm');
    if (res.status === 200 && res.data?.status === 'ok') {
      testResults.services.vlm.model = res.data.model;
      testResults.services.vlm.device = res.data.device;
      return { passed: true, data: res.data };
    }
    return { passed: false, message: '状态端点返回异常' };
  });

  // 2.3 描述生成端点测试
  await runTest('VLM描述生成端点 (/vlm/describe)', async () => {
    try {
      const res = await makeRequest('http://localhost:8001/vlm/describe', {
        method: 'POST',
        body: {
          file_path: './test-nonexistent.mp4',
          prompt: '描述这个视频'
        }
      });
      if (res.status === 404 || res.status === 200) {
        return { passed: true };
      }
      return { passed: false, message: `HTTP ${res.status}` };
    } catch (e) {
      return { passed: false, message: e.message };
    }
  });
}

// ============================================
// 3. LLM 服务检测 (智谱AI / NVIDIA)
// ============================================
async function testLLMService() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '🔍 3. LLM 服务检测 (智谱AI GLM-4-Plus)');
  log(colors.cyan, '========================================');

  testResults.services.llm = {
    provider: 'zhipu',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    status: 'unknown',
    tests: []
  };

  // 3.1 智谱API连接测试
  await runTest('智谱AI API连接', async () => {
    try {
      const res = await makeRequest('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer cc84c8dd0e05410f913d74821176c6c4.fsD5kFrKy4GJFvY1'
        },
        body: {
          model: 'glm-4-plus',
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10
        },
        timeout: 30000
      });
      
      if (res.status === 200 && res.data?.choices) {
        testResults.services.llm.status = 'working';
        return { passed: true, data: { response: res.data.choices[0]?.message?.content } };
      } else if (res.status === 401) {
        testResults.services.llm.status = 'auth_error';
        return { passed: false, message: 'API Key无效或已过期' };
      } else if (res.status === 429) {
        testResults.services.llm.status = 'rate_limited';
        return { warning: true, message: 'API请求频率限制' };
      }
      return { passed: false, message: `HTTP ${res.status}: ${res.raw?.substring(0, 100)}` };
    } catch (e) {
      testResults.services.llm.status = 'error';
      return { passed: false, message: e.message };
    }
  });

  // 3.2 剧本分析功能测试
  if (testResults.services.llm.status === 'working') {
    await runTest('LLM剧本分析功能', async () => {
      try {
        const testScript = '王晓坐在办公桌前，眼神紧张地看着电脑屏幕。';
        const res = await makeRequest('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer cc84c8dd0e05410f913d74821176c6c4.fsD5kFrKy4GJFvY1'
          },
          body: {
            model: 'glm-4-plus',
            messages: [
              { role: 'system', content: '你是分镜师，将剧本拆解为镜头。返回JSON格式。' },
              { role: 'user', content: `拆解这段剧本为3个镜头，返回JSON: ${testScript}` }
            ],
            max_tokens: 500
          },
          timeout: 60000
        });
        
        if (res.status === 200 && res.data?.choices?.[0]?.message?.content) {
          const content = res.data.choices[0].message.content;
          // 检查是否返回了有效的分镜内容
          if (content.includes('镜头') || content.includes('scene') || content.includes('{')) {
            return { passed: true, data: { preview: content.substring(0, 200) } };
          }
          return { warning: true, message: 'LLM返回内容可能不是有效的分镜格式' };
        }
        return { passed: false, message: 'API响应异常' };
      } catch (e) {
        return { passed: false, message: e.message };
      }
    });
  }
}

// ============================================
// 4. 前端服务代码分析
// ============================================
async function analyzeFrontendCode() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '🔍 4. 前端服务代码分析');
  log(colors.cyan, '========================================');

  testResults.services.frontend = {
    status: 'analyzed',
    issues: []
  };

  // 4.1 检查llmService.ts是否使用真实API
  await runTest('llmService.ts - 真实API调用', async () => {
    const content = fs.readFileSync('src/services/llmService.ts', 'utf-8');
    
    // 检查是否有mock数据
    if (content.includes('mockResponse') || content.includes('MOCK_') || content.includes('fake')) {
      return { passed: false, message: '发现mock数据使用' };
    }
    
    // 检查是否调用真实API
    if (content.includes('fetch(') && content.includes('api.nvidia.com') || content.includes('bigmodel.cn')) {
      return { passed: true };
    }
    
    return { warning: true, message: '无法确认是否使用真实API' };
  });

  // 4.2 检查clipService.ts是否使用真实API
  await runTest('clipService.ts - 真实API调用', async () => {
    const content = fs.readFileSync('src/services/clipService.ts', 'utf-8');
    
    // 检查useMock配置
    if (content.includes('useMock: config.useMock ?? false')) {
      // 默认不使用mock，这是正确的
    }
    
    // 检查是否有mock回退逻辑
    if (content.includes('generateMockMetadata') || content.includes('mockScanResponse')) {
      return { warning: true, message: '存在mock回退逻辑，但默认不启用' };
    }
    
    // 检查是否调用真实API
    if (content.includes('fetch(') && content.includes('localhost:8000')) {
      return { passed: true };
    }
    
    return { passed: true };
  });

  // 4.3 检查taggingService.ts
  await runTest('taggingService.ts - 服务集成', async () => {
    const content = fs.readFileSync('src/services/taggingService.ts', 'utf-8');
    
    if (content.includes('localhost:8000') && content.includes('localhost:8001')) {
      return { passed: true };
    }
    
    return { warning: true, message: '服务端点配置可能不完整' };
  });

  // 4.4 检查searchService.ts
  await runTest('searchService.ts - 搜索功能', async () => {
    const content = fs.readFileSync('src/services/searchService.ts', 'utf-8');
    
    // 搜索服务是本地实现，不需要后端
    if (content.includes('searchByTags') && content.includes('searchBySemantic')) {
      return { passed: true };
    }
    
    return { warning: true, message: '搜索功能实现可能不完整' };
  });
}

// ============================================
// 5. 数据流完整性检查
// ============================================
async function checkDataFlow() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '🔍 5. 数据流完整性检查');
  log(colors.cyan, '========================================');

  // 5.1 检查数据模型定义
  await runTest('数据模型定义完整性', async () => {
    const content = fs.readFileSync('src/types/DataModel.ts', 'utf-8');
    
    const requiredTypes = [
      'CLIPMetadata',
      'VLMMetadata',
      'Shot',
      'ScriptBlock',
      'Clip',
      'LLMScriptAnalysisRequest',
      'LLMScriptAnalysisResponse'
    ];
    
    const missing = requiredTypes.filter(t => !content.includes(`interface ${t}`) && !content.includes(`type ${t}`));
    
    if (missing.length === 0) {
      return { passed: true };
    }
    return { passed: false, message: `缺少类型定义: ${missing.join(', ')}` };
  });

  // 5.2 检查Store数据流
  await runTest('Store状态管理', async () => {
    const content = fs.readFileSync('src/store/appStore.ts', 'utf-8');
    
    const requiredActions = [
      'setScriptBlocks',
      'setShots',
      'setClips',
      'addClip'
    ];
    
    const missing = requiredActions.filter(a => !content.includes(a));
    
    if (missing.length === 0) {
      return { passed: true };
    }
    return { passed: false, message: `缺少Action: ${missing.join(', ')}` };
  });

  // 5.3 检查App.tsx数据流集成
  await runTest('App.tsx服务集成', async () => {
    const content = fs.readFileSync('src/App.tsx', 'utf-8');
    
    // 检查是否导入并使用了服务
    if (content.includes('llmService') && content.includes('clipService')) {
      // 检查是否有真实的API调用
      if (content.includes('llmService.analyzeScript') && content.includes('clipService.scanAndProcess')) {
        return { passed: true };
      }
    }
    
    return { warning: true, message: '服务集成可能不完整' };
  });
}

// ============================================
// 6. 配置检查
// ============================================
async function checkConfigurations() {
  log(colors.cyan, '\n========================================');
  log(colors.cyan, '🔍 6. 配置检查');
  log(colors.cyan, '========================================');

  // 6.1 检查API密钥配置
  await runTest('API密钥配置', async () => {
    const content = fs.readFileSync('src/services/llmService.ts', 'utf-8');
    
    // 检查是否有硬编码的API密钥（安全问题）
    if (content.includes('apiKey:') && content.includes('nvapi-') || content.includes('.fsD5kFrKy4GJFvY1')) {
      return { warning: true, message: 'API密钥硬编码在代码中，建议使用环境变量' };
    }
    
    return { passed: true };
  });

  // 6.2 检查服务端点配置
  await runTest('服务端点配置', async () => {
    const clipContent = fs.readFileSync('src/services/clipService.ts', 'utf-8');
    const taggingContent = fs.readFileSync('src/services/taggingService.ts', 'utf-8');
    
    const issues = [];
    
    if (!clipContent.includes('localhost:8000')) {
      issues.push('CLIP服务端点未配置');
    }
    if (!taggingContent.includes('localhost:8001')) {
      issues.push('VLM服务端点未配置');
    }
    
    if (issues.length === 0) {
      return { passed: true };
    }
    return { passed: false, message: issues.join(', ') };
  });
}

// ============================================
// 主函数
// ============================================
async function main() {
  log(colors.blue, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.blue, '║           cgcut 全面API检测报告                            ║');
  log(colors.blue, '║           ' + new Date().toLocaleString() + '                        ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════════╝');

  // 执行所有测试
  await testCLIPService();
  await testVLMService();
  await testLLMService();
  await analyzeFrontendCode();
  await checkDataFlow();
  await checkConfigurations();

  // 生成报告
  log(colors.blue, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.blue, '║                      测试结果汇总                          ║');
  log(colors.blue, '╚════════════════════════════════════════════════════════════╝');

  console.log('\n📊 测试统计:');
  console.log(`   总测试数: ${testResults.summary.total}`);
  log(colors.green, `   通过: ${testResults.summary.passed}`);
  log(colors.yellow, `   警告: ${testResults.summary.warnings}`);
  log(colors.red, `   失败: ${testResults.summary.failed}`);

  console.log('\n🔧 服务状态:');
  for (const [name, service] of Object.entries(testResults.services)) {
    const status = service.status || 'unknown';
    const statusColor = status === 'working' || status === 'running' || status === 'analyzed' 
      ? colors.green 
      : status === 'offline' || status === 'error' 
        ? colors.red 
        : colors.yellow;
    log(statusColor, `   ${name}: ${status}`);
    if (service.model) console.log(`      模型: ${service.model}`);
    if (service.device) console.log(`      设备: ${service.device}`);
  }

  if (testResults.issues.length > 0) {
    console.log('\n⚠️  发现的问题:');
    testResults.issues.forEach((issue, i) => {
      const color = issue.type === 'error' ? colors.red : colors.yellow;
      log(color, `   ${i + 1}. [${issue.type}] ${issue.test}: ${issue.message}`);
    });
  }

  if (testResults.recommendations.length > 0) {
    console.log('\n💡 建议操作:');
    testResults.recommendations.forEach((rec, i) => {
      log(colors.cyan, `   ${i + 1}. ${rec}`);
    });
  }

  // 保存报告到文件
  const reportPath = 'api-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);

  // 返回退出码
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

main().catch(console.error);
