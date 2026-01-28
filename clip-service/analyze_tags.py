# -*- coding: utf-8 -*-
"""分析标签分布"""
import json
from collections import Counter

with open('clip_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

tag_counter = Counter()
for item in data:
    if item.get('clipMetadata') and 'tags' in item['clipMetadata']:
        for tag in item['clipMetadata']['tags']:
            tag_counter[tag] += 1

# 输出到文件避免编码问题
with open('tag_analysis.txt', 'w', encoding='utf-8') as f:
    f.write('标签分布分析\n')
    f.write('=' * 50 + '\n\n')
    f.write('Top 30 标签:\n')
    for tag, count in tag_counter.most_common(30):
        pct = count / len(data) * 100
        f.write(f'  {tag}: {count} ({pct:.1f}%)\n')

    f.write(f'\n总素材数: {len(data)}\n')
    f.write(f'总标签种类: {len(tag_counter)}\n')

    # 关键问题分析
    f.write('\n问题分析:\n')
    f.write('-' * 50 + '\n')
    office_count = tag_counter.get('办公室', 0)
    street_count = tag_counter.get('街道', 0)
    night_count = tag_counter.get('夜晚', 0)
    anime_count = tag_counter.get('动漫场景', 0)
    outdoor_count = tag_counter.get('室外场景', 0)

    f.write(
        f'办公室标签覆盖: {office_count} ({office_count/len(data)*100:.1f}%) - 过于泛化!\n')
    f.write(f'街道标签: {street_count} ({street_count/len(data)*100:.1f}%)\n')
    f.write(f'夜晚标签: {night_count} ({night_count/len(data)*100:.1f}%)\n')
    f.write(f'动漫场景标签: {anime_count} ({anime_count/len(data)*100:.1f}%)\n')
    f.write(f'室外场景标签: {outdoor_count} ({outdoor_count/len(data)*100:.1f}%)\n')

print('分析完成，结果保存到 tag_analysis.txt')
