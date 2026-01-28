/**
 * 视频显示验证RPA测试
 * 使用"全链路检查"功能后验证视频是否正常显示
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
    console.log('='.repeat(60));
    console.log('🎬 视频显示验证测试 - 使用全链路检查');
    console.log('='.repeat(60));
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // 收集控制台日志
    const consoleLogs = [];
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        }
    });

    try {
        // 1. 打开页面
        console.log('\n📋 步骤 1: 打开应用');
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const ts = Date.now();
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `verify-01-initial-${ts}.png`) });
        console.log('   ✅ 页面加载完成');
        
        // 2. 点击"全链路检查"按钮
        console.log('\n📋 步骤 2: 点击"全链路检查"按钮');
        const pipelineBtn = page.locator('button:has-text("全链路检查")');
        if (await pipelineBtn.isVisible()) {
            await pipelineBtn.click();
            console.log('   ✅ 已点击全链路检查按钮');
            
            // 等待检查完成 (最多 60 秒)
            console.log('   ⏳ 等待全链路检查完成...');
            await page.waitForTimeout(5000); // 初始等待
            
            // 等待进度完成或按钮恢复
            let attempts = 0;
            while (attempts < 12) {
                const btnText = await pipelineBtn.textContent();
                if (btnText && !btnText.includes('检查中')) {
                    break;
                }
                await page.waitForTimeout(5000);
                attempts++;
                console.log(`   ... 等待中 (${attempts * 5}s)`);
            }
            
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, `verify-02-after-pipeline-${ts}.png`) });
            console.log('   ✅ 全链路检查完成');
        } else {
            console.log('   ⚠️ 未找到全链路检查按钮');
        }
        
        // 3. 检查时间轴上的clips
        console.log('\n📋 步骤 3: 检查时间轴状态');
        const clipElements = await page.$$('[data-clip]');
        console.log(`   Clip数量: ${clipElements.length}`);
        
        const placeholders = await page.$$('text=占位符');
        console.log(`   占位符数量: ${placeholders.length}`);
        
        // 4. 检查视频元素
        console.log('\n📋 步骤 4: 检查视频元素');
        const videoElements = await page.$$('video');
        console.log(`   视频元素数量: ${videoElements.length}`);
        
        for (let i = 0; i < videoElements.length; i++) {
            const video = videoElements[i];
            const src = await video.getAttribute('src');
            const readyState = await video.evaluate(v => v.readyState);
            console.log(`   视频 ${i+1}: src=${src ? src.substring(0, 50) + '...' : '无'}, readyState=${readyState}`);
        }
        
        // 5. 检查"素材未就绪"提示是否消失
        console.log('\n📋 步骤 5: 检查素材状态');
        const materialNotReady = await page.locator('text=素材未就绪').isVisible().catch(() => false);
        console.log(`   "素材未就绪"提示: ${materialNotReady ? '⚠️ 显示' : '✅ 不显示'}`);
        
        const emptyTimeline = await page.locator('text=将镜头添加到时间轴').isVisible().catch(() => false);
        console.log(`   "空时间轴"提示: ${emptyTimeline ? '⚠️ 显示' : '✅ 不显示'}`);
        
        // 6. 最终截图
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `verify-03-final-${ts}.png`), fullPage: true });
        console.log('\n✅ 截图已保存');
        
        // 总结
        console.log('\n' + '='.repeat(60));
        console.log('📊 测试结果');
        console.log('='.repeat(60));
        
        const hasVideo = videoElements.length > 0;
        const noPlaceholders = placeholders.length === 0;
        const noWarnings = !materialNotReady;
        
        if (hasVideo && noWarnings) {
            console.log('✅ 视频显示正常！');
        } else if (clipElements.length > 0 && !noPlaceholders) {
            console.log('⚠️ 有Clips但都是占位符 - CLIP搜索可能没有匹配到视频');
            console.log('   建议：确保CLIP索引中包含匹配的视频');
        } else if (materialNotReady) {
            console.log('⚠️ 显示"素材未就绪" - Shot的file_path为空');
            console.log('   建议：检查CLIP搜索结果是否返回了有效的filePath');
        } else {
            console.log('❌ 视频未显示');
        }
        
        if (consoleLogs.length > 0) {
            console.log('\n控制台错误/警告:');
            consoleLogs.slice(0, 5).forEach(log => {
                console.log(`  [${log.type}] ${log.text.substring(0, 100)}`);
            });
        }
        
    } catch (error) {
        console.error('\n❌ 测试出错:', error.message);
    }
    
    await browser.close();
    console.log('\n✅ 测试完成');
}

runTest().catch(console.error);
