# -*- coding: utf-8 -*-
"""验证新素材的向量和标签数据"""
import json

with open('clip_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 检查新素材
new_assets = [d for d in data if '02类型-三渲二' in d.get('filePath', '')]

with open('verify_data.txt', 'w', encoding='utf-8') as f:
    f.write('=== 新素材入库验证 ===\n\n')
    f.write(f'新素材总数: {len(new_assets)}\n')

    with_emb = [d for d in new_assets if d.get(
        'clipMetadata', {}).get('embeddings')]
    f.write(f'有向量数据: {len(with_emb)}\n')

    # 抽样检查
    f.write('\n=== 抽样检查 (前5条) ===\n\n')
    for i, asset in enumerate(new_assets[:5]):
        emb = asset.get('clipMetadata', {}).get('embeddings', [])
        tags = asset.get('clipMetadata', {}).get('tags', [])
        label = asset.get('label', '')[:50]
        filepath = asset.get('filePath', '')

        f.write(f'{i+1}. 文件: {label}\n')
        f.write(f'   路径: {filepath[:60]}...\n')
        f.write(f'   向量: {len(emb)} 维\n')
        f.write(
            f'   向量首5值: {[round(v, 4) for v in emb[:5]] if emb else "无"}\n')
        f.write(f'   标签: {tags}\n\n')

    # 统计标签分布
    f.write('\n=== 新素材标签分布 ===\n\n')
    from collections import Counter
    tag_counter = Counter()
    for asset in new_assets:
        for tag in asset.get('clipMetadata', {}).get('tags', []):
            tag_counter[tag] += 1

    for tag, count in tag_counter.most_common(15):
        pct = count / len(new_assets) * 100
        f.write(f'  {tag}: {count} ({pct:.1f}%)\n')

print('结果保存到 verify_data.txt')
