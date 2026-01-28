#!/usr/bin/env node
/**
 * CGCUT 环境变量安全管理脚本
 * 用于生成、验证和管理API密钥等敏感信息
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置文件路径
const ENV_FILE = '.env';
const ENV_EXAMPLE_FILE = '.env.example';
const CONFIG_FILE = 'env-config.json';

// 默认配置
const DEFAULT_CONFIG = {
  // API服务密钥
  CLIP_SERVICE_API_KEY: {
    required: true,
    description: 'CLIP服务API密钥',
    generator: () => generateApiKey('clip'),
    validate: (key) => key && key.length >= 32,
    source: 'manual'
  },
  VLM_SERVICE_API_KEY: {
    required: true,
    description: 'VLM服务API密钥',
    generator: () => generateApiKey('vlm'),
    validate: (key) => key && key.length >= 32,
    source: 'manual'
  },
  // AI提供商API密钥
  VITE_ZHIPU_API_KEY: {
    required: true,
    description: '智谱AI API密钥',
    generator: () => generateApiKey('zhipu'),
    validate: (key) => key && key.length >= 20,
    source: 'manual'
  },
  VITE_NVIDIA_API_KEY: {
    required: false,
    description: 'NVIDIA API密钥（备选）',
    generator: () => generateApiKey('nvidia'),
    validate: (key) => key && key.length >= 20,
    source: 'manual'
  },
  // 服务配置
  VITE_CLIP_SERVICE_URL: {
    required: false,
    description: 'CLIP服务URL',
    default: 'http://localhost:8000',
    validate: (url) => url.startsWith('http://') || url.startsWith('https://'),
    source: 'default'
  },
  VITE_VLM_SERVICE_URL: {
    required: false,
    description: 'VLM服务URL',
    default: 'http://localhost:8001',
    validate: (url) => url.startsWith('http://') || url.startsWith('https://'),
    source: 'default'
  },
  // 应用配置
  VITE_APP_ENV: {
    required: false,
    description: '应用环境',
    default: 'development',
    validate: (env) => ['development', 'production'].includes(env),
    source: 'default'
  }
};

// 生成API密钥
function generateApiKey(service) {
  const prefix = service.toUpperCase();
  const random = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `${prefix}_${random}_${timestamp}`;
}

// 颜色输出
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

// 命令行参数解析
const args = process.argv.slice(2);
const command = args[0];

// 创建环境配置文件
function createEnvConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    log(colors.green, '✅ 环境配置文件已创建:', CONFIG_FILE);
  }
}

// 加载环境配置
function loadEnvConfig() {
  createEnvConfig();
  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // 合并默认配置和用户配置
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch (error) {
    log(colors.red, '❌ 加载环境配置失败:', error.message);
    process.exit(1);
  }
}

// 检查环境变量文件
function checkEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    log(colors.yellow, '⚠️  环境变量文件不存在，将创建新文件');
    createEnvFile();
    return false;
  }
  
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  const currentVars = parseEnvFile(envContent);
  
  const config = loadEnvConfig();
  const missingVars = [];
  const invalidVars = [];
  
  // 检查必需变量
  for (const [key, config] of Object.entries(config)) {
    if (config.required && !currentVars[key]) {
      missingVars.push(key);
    }
    
    if (currentVars[key] && config.validate && !config.validate(currentVars[key])) {
      invalidVars.push({ key, value: currentVars[key] });
    }
  }
  
  return { missingVars, invalidVars, currentVars, config };
}

// 解析.env文件
function parseEnvFile(content) {
  const vars = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        vars[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  
  return vars;
}

// 创建.env文件
function createEnvFile() {
  const config = loadEnvConfig();
  let envContent = '# CGCUT 环境变量配置文件\n';
  envContent += '# 生成时间: ' + new Date().toISOString() + '\n\n';
  
  for (const [key, config] of Object.entries(config)) {
    const comment = `# ${config.description}`;
    const defaultValue = config.default ? ` # 默认: ${config.default}` : '';
    const required = config.required ? ' (必需)' : '';
    
    envContent += `${comment}${required}${defaultValue}\n`;
    envContent += `${key}=${config.default || ''}\n\n`;
  }
  
  fs.writeFileSync(ENV_FILE, envContent);
  log(colors.green, '✅ 环境变量文件已创建:', ENV_FILE);
}

// 更新环境变量
function updateEnvFile(updates) {
  let envContent = '';
  
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }
  
  const currentVars = parseEnvFile(envContent);
  const updatedVars = { ...currentVars, ...updates };
  
  // 重新格式化文件
  let newContent = '# CGCUT 环境变量配置文件\n';
  newContent += '# 最后更新: ' + new Date().toISOString() + '\n\n';
  
  const config = loadEnvConfig();
  for (const [key, value] of Object.entries(updatedVars)) {
    const configInfo = config[key] || {};
    const comment = `# ${configInfo.description || '配置项'}`;
    const source = configInfo.source === 'default' ? ' # [默认]' : '';
    
    newContent += `${comment}${source}\n`;
    newContent += `${key}=${value || ''}\n\n`;
  }
  
  fs.writeFileSync(ENV_FILE, newContent);
}

// 验证环境变量
function validateEnv() {
  const result = checkEnvFile();
  const { missingVars, invalidVars, config } = result;
  
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '     环境变量验证报告');
  log(colors.cyan, '='.repeat(60) + '\n');
  
  // 检查缺失的变量
  if (missingVars.length > 0) {
    log(colors.red, '❌ 缺失必需的环境变量:');
    missingVars.forEach(key => {
      const configInfo = config[key];
      log(colors.white, `   - ${key}: ${configInfo.description}`);
    });
    console.log();
  }
  
  // 检查无效的变量
  if (invalidVars.length > 0) {
    log(colors.yellow, '⚠️  无效的环境变量:');
    invalidVars.forEach(({ key, value }) => {
      const configInfo = config[key];
      log(colors.white, `   - ${key}: ${value} (不符合格式要求)`);
    });
    console.log();
  }
  
  // 显示当前配置
  if (missingVars.length === 0 && invalidVars.length === 0) {
    log(colors.green, '✅ 所有环境变量配置正确');
  }
  
  return missingVars.length === 0 && invalidVars.length === 0;
}

// 生成新的API密钥
function generateApiKeys() {
  const config = loadEnvConfig();
  const updates = {};
  
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '     生成新的API密钥');
  log(colors.cyan, '='.repeat(60) + '\n');
  
  for (const [key, config] of Object.entries(config)) {
    if (config.generator && config.required) {
      const newKey = config.generator();
      updates[key] = newKey;
      log(colors.green, `✅ ${key}: ${newKey.substring(0, 20)}...`);
    }
  }
  
  if (Object.keys(updates).length > 0) {
    updateEnvFile(updates);
    console.log();
    log(colors.yellow, '⚠️  请妥善保存生成的API密钥');
    log(colors.yellow, '   建议将密钥存储在安全的位置，如密码管理器中');
  }
}

// 显示环境变量状态
function showEnvStatus() {
  const result = checkEnvFile();
  const { currentVars, config } = result;
  
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '     环境变量状态');
  log(colors.cyan, '='.repeat(60) + '\n');
  
  for (const [key, configInfo] of Object.entries(config)) {
    const value = currentVars[key] || '[未设置]';
    const status = value && configInfo.validate ? '✅' : '⚠️';
    const source = configInfo.source === 'default' ? '[默认]' : '[手动]';
    
    log(colors.white, `${status} ${key} ${source}`);
    log(colors.cyan, `   描述: ${configInfo.description}`);
    if (value !== '[未设置]') {
      log(colors.yellow, `   值: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
    }
    if (configInfo.required) {
      log(colors.red, `   状态: ${value === '[未设置]' ? '缺失' : '已设置'}`);
    }
    console.log();
  }
}

// 命令处理
function handleCommand() {
  switch (command) {
    case 'init':
      createEnvFile();
      break;
      
    case 'validate':
      const isValid = validateEnv();
      if (!isValid) {
        process.exit(1);
      }
      break;
      
    case 'generate':
      generateApiKeys();
      break;
      
    case 'status':
      showEnvStatus();
      break;
      
    case 'set':
      if (args.length < 3) {
        log(colors.red, '❌ 用法: node env-manager.js set <变量名> <值>');
        process.exit(1);
      }
      const key = args[1];
      const value = args[2];
      updateEnvFile({ [key]: value });
      log(colors.green, `✅ 已设置 ${key} = ${value}`);
      break;
      
    case 'unset':
      if (args.length < 2) {
        log(colors.red, '❌ 用法: node env-manager.js unset <变量名>');
        process.exit(1);
      }
      const unsetKey = args[1];
      const currentVars = parseEnvFile(fs.readFileSync(ENV_FILE, 'utf-8'));
      delete currentVars[unsetKey];
      updateEnvFile(currentVars);
      log(colors.green, `✅ 已清除 ${unsetKey}`);
      break;
      
    case 'help':
    default:
      showHelp();
      break;
  }
}

// 显示帮助信息
function showHelp() {
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, '     CGCUT 环境变量管理工具');
  log(colors.cyan, '='.repeat(60) + '\n');
  
  log(colors.white, '用法: node env-manager.js <命令>\n');
  
  log(colors.white, '可用命令:');
  log(colors.green, '  init         - 初始化环境变量文件');
  log(colors.green, '  validate     - 验证环境变量配置');
  log(colors.green, '  generate     - 生成新的API密钥');
  log(colors.green, '  status       - 显示环境变量状态');
  log(colors.green, '  set <key> <value> - 设置环境变量');
  log(colors.green, '  unset <key>  - 清除环境变量');
  log(colors.green, '  help         - 显示此帮助信息\n');
  
  log(colors.white, '示例:');
  log(colors.yellow, '  node env-manager.js init');
  log(colors.yellow, '  node env-manager.js validate');
  log(colors.yellow, '  node env-manager.js generate');
  log(colors.yellow, '  node env-manager.js set VITE_ZHIPU_API_KEY your_api_key_here\n');
  
  log(colors.red, '⚠️  重要提示:');
  log(colors.white, '  - 请勿将包含API密钥的.env文件提交到版本控制');
  log(colors.white, '  - 在.gitignore中确保.env文件被忽略');
  log(colors.white, '  - 生产环境中使用环境变量或密钥管理服务\n');
}

// 主函数
function main() {
  if (!command) {
    showHelp();
    return;
  }
  
  handleCommand();
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  createEnvFile,
  validateEnv,
  generateApiKeys,
  showEnvStatus,
  loadEnvConfig,
  checkEnvFile
};