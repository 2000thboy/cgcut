"""扫描视频并索引到 CLIP 服务"""
import requests
import json
import os

CLIP_URL = "http://localhost:8000"
TEST_DIR = r"E:\CGCUT\test-assets"

print("="*60)
print("扫描 test-assets 并索引到 CLIP 服务")
print("="*60)

# 扫描并处理视频
print('\n扫描目录...')
try:
    r = requests.post(
        f'{CLIP_URL}/clip/scan',
        json={
            'directory': TEST_DIR,
            'file_patterns': ['*.mp4'],
            'extract_keyframes': True
        },
        timeout=600
    )
    
    if r.status_code == 200:
        data = r.json()
        print(f"✅ 扫描完成!")
        print(f"   总文件: {data.get('summary', {}).get('totalFiles', 0)}")
        print(f"   已处理: {data.get('summary', {}).get('processed', 0)}")
        print(f"   失败: {data.get('summary', {}).get('failed', 0)}")
        
        # 显示处理结果
        for f in data.get('processedFiles', []):
            basename = os.path.basename(f.get('filePath', ''))
            status = f.get('status', 'unknown')
            tags = f.get('clipMetadata', {}).get('tags', [])[:3]
            print(f"   - {basename}: {status} {tags}")
        
        # 保存结果
        processed = data.get('processedFiles', [])
        if processed:
            save_r = requests.post(
                f'{CLIP_URL}/clip/save-results',
                json={'results': processed},
                timeout=30
            )
            print(f'\n✅ 保存结果: {save_r.json()}')
    else:
        print(f"❌ 错误: {r.status_code} - {r.text[:200]}")
        
except Exception as e:
    print(f"❌ 发生错误: {e}")

# 验证
print('\n验证已索引结果...')
try:
    r = requests.get(f'{CLIP_URL}/clip/results')
    if r.status_code == 200:
        data = r.json()
        print(f"✅ 共索引 {data.get('total', 0)} 个视频")
    else:
        print(f"⚠️ 获取失败: {r.status_code}")
except Exception as e:
    print(f"❌ 错误: {e}")

print("\n" + "="*60)
print("完成！")
