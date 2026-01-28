/**
 * 搜索质量诊断测试
 */
import http from 'http';

async function testSearch(query) {
    return new Promise((resolve) => {
        const url = `http://localhost:8000/clip/search?query=${encodeURIComponent(query)}&top_k=5`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`\n【Query: "${query}"】`);
                    console.log(`Found: ${result.total} / ${result.searched}`);
                    if (result.results && result.results.length > 0) {
                        result.results.forEach((r, i) => {
                            const label = r.label ? r.label.substring(0, 35) : 'unknown';
                            console.log(`  ${i + 1}. sim=${r.similarity.toFixed(4)} | ${label}`);
                            if (r.tags) console.log(`     Tags: ${r.tags.slice(0, 3).join(', ')}`);
                        });
                    }
                } catch (e) {
                    console.error('Parse error:', e.message);
                }
                resolve();
            });
        }).on('error', (e) => {
            console.error('Request error:', e.message);
            resolve();
        });
    });
}

(async () => {
    console.log('='.repeat(60));
    console.log('CLIP 搜索质量诊断');
    console.log('='.repeat(60));
    
    // 中文查询测试
    await testSearch('打斗场景');
    await testSearch('室内对话');
    await testSearch('人物特写');
    await testSearch('紧张氛围');
    await testSearch('夜晚城市');
    
    // 英文查询测试
    await testSearch('fighting scene');
    await testSearch('indoor dialogue');
    await testSearch('close up face');
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成');
})();
