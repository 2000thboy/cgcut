import { chromium } from 'playwright';

async function debugSearch() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Starting Search Debug...');

  // 监听所有搜索请求
  page.on('response', async response => {
    if (response.url().includes('/clip/search')) {
      const status = response.status();
      const text = await response.text();
      console.log(`[Network] CLIP Search Response (${status}):`, text.substring(0, 500));
    }
  });

  try {
    await page.goto('http://localhost:5173');
    
    // 等待页面加载
    await page.waitForSelector('button:has-text("全链路检查")');
    
    console.log('Clicking Full Pipeline Check...');
    await page.click('button:has-text("全链路检查")');
    
    // 等待弹窗出现
    await page.waitForSelector('text=全链路检查完成', { timeout: 120000 });
    
    console.log('Pipeline Finished.');
  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await browser.close();
  }
}

debugSearch();
