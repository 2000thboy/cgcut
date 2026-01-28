/**
 * 视频显示全面RPA测试
 * 用于诊断前端视频显示问题
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runRPATest() {
    console.log('='.repeat(60));
    console.log('🎬 视频显示全面 RPA 检测');
    console.log('='.repeat(60));
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    // 捕获控制台日志
    const consoleLogs = [];
    const page = await context.newPage();
    
    page.on('console', msg => {
        consoleLogs.push({
            type: msg.type(),
            text: msg.text(),
            location: msg.location()
        });
    });
    
    // 捕获页面错误
    const pageErrors = [];
    page.on('pageerror', error => {
        pageErrors.push(error.message);
    });
    
    // 捕获网络请求失败
    const failedRequests = [];
    page.on('requestfailed', request => {
        failedRequests.push({
            url: request.url(),
            failure: request.failure()?.errorText
        });
    });

    const results = {
        timestamp: new Date().toISOString(),
        tests: [],
        consoleLogs: [],
        pageErrors: [],
        failedRequests: [],
        summary: {}
    };

    try {
        // 测试1: 页面加载
        console.log('\n📋 测试 1: 页面加载检查');
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const screenshotPath1 = path.join(SCREENSHOT_DIR, '01_initial_load.png');
        await page.screenshot({ path: screenshotPath1, fullPage: true });
        console.log(`   ✅ 页面加载成功，截图保存到: ${screenshotPath1}`);
        results.tests.push({ name: '页面加载', status: 'PASS', screenshot: screenshotPath1 });
        
        // 测试2: 检查主要UI组件
        console.log('\n📋 测试 2: 主要UI组件检查');
        
        // 检查视频预览区域
        const videoPreview = await page.$('.bg-gray-900');
        console.log(`   视频预览区域: ${videoPreview ? '✅ 存在' : '❌ 不存在'}`);
        
        // 检查时间轴
        const timeline = await page.$('[class*="timeline"]') || await page.locator('text=时间轴').first();
        const timelineExists = await timeline?.isVisible() || false;
        console.log(`   时间轴组件: ${timelineExists ? '✅ 存在' : '❌ 不存在'}`);
        
        // 检查视频元素
        const videoElements = await page.$$('video');
        console.log(`   视频元素数量: ${videoElements.length}`);
        
        results.tests.push({ 
            name: 'UI组件检查', 
            status: 'PASS',
            details: {
                videoPreview: !!videoPreview,
                timeline: timelineExists,
                videoElements: videoElements.length
            }
        });
        
        // 测试3: 检查clips和timeline状态
        console.log('\n📋 测试 3: 时间轴和Clips状态检查');
        
        // 查找时间轴相关文本
        const timelineContent = await page.locator('.flex-1.flex.flex-col.overflow-hidden').textContent().catch(() => '');
        console.log(`   时间轴内容: ${timelineContent.substring(0, 100)}...`);
        
        // 检查是否有clips
        const clipElements = await page.$$('[data-clip]');
        console.log(`   Clip 元素数量: ${clipElements.length}`);
        
        // 检查占位符
        const placeholders = await page.$$('text=占位符');
        console.log(`   占位符数量: ${placeholders.length}`);
        
        // 检查"将镜头添加到时间轴"消息
        const addShotMessage = await page.locator('text=将镜头添加到时间轴').isVisible().catch(() => false);
        console.log(`   空时间轴提示: ${addShotMessage ? '✅ 显示' : '❌ 不显示'}`);
        
        // 检查"素材未就绪"消息
        const materialNotReady = await page.locator('text=素材未就绪').isVisible().catch(() => false);
        console.log(`   素材未就绪提示: ${materialNotReady ? '⚠️ 显示' : '✅ 不显示'}`);
        
        results.tests.push({ 
            name: 'Clips状态检查', 
            status: clipElements.length > 0 ? 'PASS' : 'INFO',
            details: {
                clipCount: clipElements.length,
                placeholders: placeholders.length,
                emptyTimelineMessage: addShotMessage,
                materialNotReady: materialNotReady
            }
        });

        // 测试4: 检查视频元素详细信息
        console.log('\n📋 测试 4: 视频元素详细检查');
        
        for (let i = 0; i < videoElements.length; i++) {
            const video = videoElements[i];
            const src = await video.getAttribute('src');
            const readyState = await video.evaluate(v => v.readyState);
            const error = await video.evaluate(v => v.error ? v.error.message : null);
            const networkState = await video.evaluate(v => v.networkState);
            
            console.log(`   视频 ${i + 1}:`);
            console.log(`     - src: ${src || '无'}`);
            console.log(`     - readyState: ${readyState} (0=无数据, 1=有元数据, 2=正在加载, 3=可播放, 4=可完整播放)`);
            console.log(`     - networkState: ${networkState} (0=空, 1=无网络, 2=加载中, 3=已加载)`);
            if (error) console.log(`     - error: ${error}`);
            
            results.tests.push({
                name: `视频元素 ${i + 1}`,
                status: src && readyState >= 1 ? 'PASS' : 'FAIL',
                details: { src, readyState, networkState, error }
            });
        }
        
        if (videoElements.length === 0) {
            console.log('   ⚠️ 没有找到任何视频元素');
            results.tests.push({
                name: '视频元素检查',
                status: 'WARNING',
                details: { message: '没有找到任何视频元素' }
            });
        }
        
        // 测试5: 检查Store状态 (通过执行JS)
        console.log('\n📋 测试 5: Store状态检查');
        
        const storeState = await page.evaluate(() => {
            // 尝试访问zustand store
            if (window.__ZUSTAND_DEVTOOLS__) {
                return window.__ZUSTAND_DEVTOOLS__;
            }
            return null;
        });
        
        // 尝试获取React DevTools的状态
        const appState = await page.evaluate(() => {
            // 尝试通过DOM获取一些状态信息
            const timelineText = document.querySelector('[class*="timeline"]')?.textContent || '';
            const clipCount = document.querySelectorAll('[data-clip]').length;
            const hasVideo = document.querySelectorAll('video').length > 0;
            
            return {
                timelineHasContent: timelineText.length > 0,
                clipCount,
                hasVideoElements: hasVideo
            };
        });
        
        console.log(`   应用状态: ${JSON.stringify(appState, null, 2)}`);
        results.tests.push({
            name: 'Store状态',
            status: 'INFO',
            details: appState
        });
        
        // 测试6: 截取最终状态截图
        console.log('\n📋 测试 6: 最终状态截图');
        const screenshotPath2 = path.join(SCREENSHOT_DIR, '02_final_state.png');
        await page.screenshot({ path: screenshotPath2, fullPage: true });
        console.log(`   ✅ 最终状态截图: ${screenshotPath2}`);
        
        // 测试7: 检查网络请求
        console.log('\n📋 测试 7: 网络请求检查');
        
        // 检查视频请求
        const videoRequests = await page.evaluate(() => {
            return Array.from(performance.getEntriesByType('resource'))
                .filter(r => r.name.includes('.mp4') || r.name.includes('video'))
                .map(r => ({ name: r.name, duration: r.duration, transferSize: r.transferSize }));
        });
        
        console.log(`   视频相关网络请求: ${videoRequests.length}`);
        videoRequests.forEach(req => {
            console.log(`     - ${req.name.substring(0, 80)}...`);
        });
        
        results.tests.push({
            name: '网络请求',
            status: 'INFO',
            details: { videoRequests }
        });

    } catch (error) {
        console.error('\n❌ 测试过程中出错:', error.message);
        results.tests.push({
            name: '测试执行',
            status: 'ERROR',
            error: error.message
        });
    }

    // 收集日志
    results.consoleLogs = consoleLogs;
    results.pageErrors = pageErrors;
    results.failedRequests = failedRequests;

    // 打印摘要
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果摘要');
    console.log('='.repeat(60));
    
    const passCount = results.tests.filter(t => t.status === 'PASS').length;
    const failCount = results.tests.filter(t => t.status === 'FAIL').length;
    const warnCount = results.tests.filter(t => t.status === 'WARNING').length;
    
    console.log(`   ✅ 通过: ${passCount}`);
    console.log(`   ❌ 失败: ${failCount}`);
    console.log(`   ⚠️ 警告: ${warnCount}`);
    console.log(`   ℹ️ 信息: ${results.tests.length - passCount - failCount - warnCount}`);
    
    if (consoleLogs.filter(l => l.type === 'error').length > 0) {
        console.log(`\n   🔴 控制台错误: ${consoleLogs.filter(l => l.type === 'error').length}`);
        consoleLogs.filter(l => l.type === 'error').forEach(log => {
            console.log(`      - ${log.text.substring(0, 100)}`);
        });
    }
    
    if (pageErrors.length > 0) {
        console.log(`\n   🔴 页面错误: ${pageErrors.length}`);
        pageErrors.forEach(err => console.log(`      - ${err.substring(0, 100)}`));
    }
    
    if (failedRequests.length > 0) {
        console.log(`\n   🔴 失败的网络请求: ${failedRequests.length}`);
        failedRequests.forEach(req => console.log(`      - ${req.url}: ${req.failure}`));
    }
    
    results.summary = {
        total: results.tests.length,
        passed: passCount,
        failed: failCount,
        warnings: warnCount,
        consoleErrors: consoleLogs.filter(l => l.type === 'error').length,
        pageErrors: pageErrors.length,
        failedRequests: failedRequests.length
    };
    
    // 保存结果到JSON文件
    const reportPath = path.join(__dirname, 'video-display-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    
    // 诊断分析
    console.log('\n' + '='.repeat(60));
    console.log('🔍 诊断分析');
    console.log('='.repeat(60));
    
    const videoTest = results.tests.find(t => t.name.includes('视频元素'));
    const clipsTest = results.tests.find(t => t.name === 'Clips状态检查');
    
    if (clipsTest?.details?.clipCount === 0) {
        console.log('\n   📌 问题诊断: 时间轴为空');
        console.log('   原因: 没有clips被添加到时间轴');
        console.log('   建议: 需要先添加clips到时间轴才能显示视频');
    }
    
    if (clipsTest?.details?.materialNotReady) {
        console.log('\n   📌 问题诊断: 素材未就绪');
        console.log('   原因: Shot的file_path为空或无效');
        console.log('   建议: 检查Shot数据中的file_path是否正确指向视频文件');
    }
    
    if (videoTest?.details?.src === null || videoTest?.details?.src === '') {
        console.log('\n   📌 问题诊断: 视频源为空');
        console.log('   原因: currentShot.file_path没有有效值');
        console.log('   建议: 确保从CLIP服务获取的shot数据包含有效的file_path');
    }
    
    await browser.close();
    console.log('\n✅ RPA测试完成');
}

runRPATest().catch(console.error);
