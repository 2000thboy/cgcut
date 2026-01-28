# -*- coding: utf-8 -*-
"""测试搜索新素材"""
import requests
import json

# 测试搜索
resp = requests.post(
    "http://localhost:8000/clip/search",
    json={"query": "游戏CG三渲二", "top_k": 5, "threshold": 0.1},
    timeout=30
)

if resp.ok:
    data = resp.json()
    with open("search_test.txt", "w", encoding="utf-8") as f:
        f.write(f"查询: {data.get('query')}\n")
        f.write(f"结果数: {data.get('total')}\n\n")
        for i, r in enumerate(data.get('results', [])[:5]):
            label = r.get('label', '')[:50]
            path = r.get('filePath', '')
            is_new = "02类型-三渲二" in path
            tags = r.get('tags', [])[:5]
            f.write(f"{i+1}. {label}\n")
            f.write(f"   新素材: {is_new}\n")
            f.write(f"   标签: {tags}\n\n")
    print("结果保存到 search_test.txt")
else:
    print(f"错误: {resp.status_code}")
