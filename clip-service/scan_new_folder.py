# -*- coding: utf-8 -*-
"""扫描新素材文件夹"""
import requests
import json

# 扫描请求
data = {
    "directory": r"U:\PreVis_Assets\originals\02类型-三渲二 二次元类",
    "file_patterns": ["*.mp4", "*.mov", "*.avi", "*.mkv"],
    "skip_processed": True,
    "batch_size": 5
}

print(f"扫描目录: {data['directory']}")
print(f"发送请求...")

resp = requests.post(
    "http://localhost:8000/clip/scan",
    json=data,
    timeout=600
)

print(f"状态码: {resp.status_code}")
if resp.ok:
    result = resp.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}")
else:
    print(f"错误: {resp.text}")
