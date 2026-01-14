/**
 * cgcut 项目系统环境检查工具
 * 检查必要的依赖是否已安装并可正常使用
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 cgcut 项目系统环境检查工具\n');

const checks = {
  node: { installed: false, version: null, error: null },
  npm: { installed: false, version: null, error: null },
  python: { installed: false, version: null, error: null },
  pip: { installed: false, version: null, error: null },
  projectStructure: { valid: false, error: null },
  frontendDeps: { installed: false, error: null },
  backendDeps: { installed: false, error: null },
};

function runCommand(cmd) {
  try {
    const result = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    return result.trim();
  } catch (error) {
    return null;
  }
}

// 检查 Node.js
console.log('📋 检查 Node.js...');
try {
  const nodeVersion = runCommand('node --version');
  if (nodeVersion) {
    checks.node.installed = true;
    checks.node.version = nodeVersion;
    console.log(`   ✅ Node.js ${nodeVersion} 已安装`);
  } else {
    console.log('   ❌ Node.js 未安装');
    checks.node.error = 'Node.js not found';
  }
} catch (error) {
  console.log('   ❌ Node.js 检查失败');
  checks.node.error = error.message;
}

// 检查 NPM
console.log('\n📋 检查 NPM...');
try {
  const npmVersion = runCommand('npm --version');
  if (npmVersion) {
    checks.npm.installed = true;
    checks.npm.version = npmVersion;
    console.log(`   ✅ NPM ${npmVersion} 已安装`);
  } else {
    console.log('   ❌ NPM 未安装');
    checks.npm.error = 'NPM not found';
  }
} catch (error) {
  console.log('   ❌ NPM 检查失败');
  checks.npm.error = error.message;
}

// 检查 Python
console.log('\n📋 检查 Python...');
try {
  const pythonVersion = runCommand('python --version') || runCommand('py --version');
  if (pythonVersion) {
    checks.python.installed = true;
    checks.python.version = pythonVersion.includes('Python') ? pythonVersion : `Python ${pythonVersion}`;
    console.log(`   ✅ ${pythonVersion} 已安装`);
  } else {
    console.log('   ❌ Python 未安装');
    checks.python.error = 'Python not found';
  }
} catch (error) {
  console.log('   ❌ Python 检查失败');
  checks.python.error = error.message;
}

// 检查 Pip
console.log('\n📋 检查 Pip...');
try {
  const pipVersion = runCommand('pip --version');
  if (pipVersion) {
    checks.pip.installed = true;
    checks.pip.version = pipVersion;
    console.log(`   ✅ Pip 已安装`);
  } else {
    console.log('   ❌ Pip 未安装');
    checks.pip.error = 'Pip not found';
  }
} catch (error) {
  console.log('   ❌ Pip 检查失败');
  checks.pip.error = error.message;
}

// 检查项目结构
console.log('\n📋 检查项目结构...');
try {
  const requiredFiles = [
    'package.json',
    'vite.config.ts',
    'src/App.tsx',
    'clip-service/clip_server.py',
    'vlm-service/vlm_server.py'
  ];
  
  const missingFiles = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length === 0) {
    checks.projectStructure.valid = true;
    console.log('   ✅ 项目结构完整');
  } else {
    console.log(`   ❌ 缺少文件: ${missingFiles.join(', ')}`);
    checks.projectStructure.error = `Missing files: ${missingFiles.join(', ')}`;
  }
} catch (error) {
  console.log('   ❌ 项目结构检查失败');
  checks.projectStructure.error = error.message;
}

// 检查前端依赖
console.log('\n📋 检查前端依赖...');
try {
  if (fs.existsSync('package.json') && fs.existsSync('node_modules')) {
    checks.frontendDeps.installed = true;
    console.log('   ✅ 前端依赖已安装');
  } else {
    console.log('   ⚠️  前端依赖未安装 (需要运行 npm install)');
    checks.frontendDeps.error = 'Node modules not installed';
  }
} catch (error) {
  console.log('   ❌ 前端依赖检查失败');
  checks.frontendDeps.error = error.message;
}

// 检查后端依赖
console.log('\n📋 检查后端依赖...');
try {
  const clipServiceExists = fs.existsSync('clip-service/requirements.txt');
  const vlmServiceExists = fs.existsSync('vlm-service/requirements.txt');
  
  if (clipServiceExists && vlmServiceExists) {
    // 检查虚拟环境是否存在
    const venvExists = fs.existsSync('clip-service/venv');
    if (venvExists) {
      checks.backendDeps.installed = true;
      console.log('   ✅ 后端依赖已安装');
    } else {
      console.log('   ⚠️  后端依赖未安装 (需要安装 Python 虚拟环境)');
      checks.backendDeps.error = 'Python virtual environment not set up';
    }
  } else {
    console.log('   ❌ 后端依赖文件缺失');
    checks.backendDeps.error = 'Requirements files missing';
  }
} catch (error) {
  console.log('   ❌ 后端依赖检查失败');
  checks.backendDeps.error = error.message;
}

// 生成报告
console.log('\n' + '='.repeat(60));
console.log('📊 系统环境检查报告');
console.log('='.repeat(60));

const summary = {
  total: Object.keys(checks).length,
  passed: Object.values(checks).filter(check => check.installed || check.valid).length,
  failed: Object.values(checks).filter(check => !(check.installed || check.valid)).length
};

console.log(`\n总检查项: ${summary.total}`);
console.log(`✅ 通过: ${summary.passed}`);
console.log(`❌ 失败: ${summary.failed}`);

console.log('\n详细状态:');
for (const [key, check] of Object.entries(checks)) {
  let status;
  let emoji;
  if (key === 'projectStructure') {
    status = check.valid ? '通过' : '失败';
    emoji = check.valid ? '✅' : '❌';
  } else {
    status = check.installed ? '已安装' : '未安装';
    emoji = check.installed ? '✅' : '❌';
  }
  console.log(`  ${emoji} ${key}: ${status}`);
  if (check.version) {
    console.log(`      版本: ${check.version}`);
  }
  if (check.error) {
    console.log(`      错误: ${check.error}`);
  }
}

// 提供建议
console.log('\n💡 建议操作:');
const suggestions = [];

if (!checks.node.installed) {
  suggestions.push('1. 安装 Node.js (包含 npm) - 访问 https://nodejs.org/');
}
if (!checks.python.installed) {
  suggestions.push('2. 安装 Python 3.9+ - 访问 https://www.python.org/downloads/');
}
if (!checks.projectStructure.valid) {
  suggestions.push('3. 确保项目文件完整');
}
if (!checks.frontendDeps.installed) {
  suggestions.push('4. 在项目根目录运行: npm install');
}
if (!checks.backendDeps.installed) {
  suggestions.push('5. 设置 Python 虚拟环境并安装依赖:');
  suggestions.push('   cd clip-service && python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt');
  suggestions.push('   cd ../vlm-service && pip install -r requirements.txt');
}

if (suggestions.length === 0) {
  console.log('  恭喜！所有依赖均已正确安装。您可以开始使用 cgcut 项目。');
} else {
  suggestions.forEach(suggestion => console.log(suggestion));
}

console.log('\n📖 详细安装指南请查看: INSTALLATION_GUIDE.md');