#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试CLIP processor处理中文"""

from transformers import CLIPProcessor, CLIPModel
import torch

# 测试CLIP processor能否处理中文
model_name = 'openai/clip-vit-base-patch32'
processor = CLIPProcessor.from_pretrained(model_name)

test_texts = [
    'office computer anxiety',
    '办公室内，荧光灯发出微弱的嗡嗡声，主角李明独自坐在电脑前，眉头紧锁 焦虑氛围'
]

for text in test_texts:
    print(f'测试文本: {text}')
    try:
        inputs = processor(text=[text], return_tensors='pt', padding=True)
        print(f'  成功, input_ids shape: {inputs["input_ids"].shape}')
    except Exception as e:
        print(f'  失败: {e}')
    print()
