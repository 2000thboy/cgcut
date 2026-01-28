#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试POST请求"""

import requests
import json

url = "http://localhost:8000/clip/search"
query = "办公室内，荧光灯发出微弱的嗡嗡声，主角李明独自坐在电脑前，眉头紧锁 焦虑氛围"

data = {
    "query": query,
    "top_k": 3,
    "threshold": 0.0
}

print(f"查询: {query}")
print(f"数据: {data}")
print()

# 使用requests库发送POST请求
response = requests.post(url, json=data)
print(f"状态码: {response.status_code}")
print(f"响应: {response.text[:500]}")
