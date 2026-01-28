# -*- coding: utf-8 -*-
"""
标签修复脚本 v2
解决问题: "办公室"标签覆盖81.9%素材，导致搜索无效

策略:
1. 移除"办公室"这个泛化标签（没有区分度）
2. 保留有区分度的标签（街道、夜晚、动漫场景等）
3. 基于文件路径关键词添加更精准的标签
"""
import json
import re
from collections import Counter

# 文件路径关键词 -> 标签映射
PATH_TAG_RULES = [
    # 场景类型
    (r'街道|城市|都市|马路', ['街道', '室外场景', '城市']),
    (r'夜晚|深夜|凌晨|夜间|夜景', ['夜晚', '昏暗场景']),
    (r'白天|日间|阳光', ['白天', '明亮场景']),
    (r'室外|户外|外景', ['室外场景']),
    (r'室内|房间|屋内', ['室内场景']),

    # 动漫素材标识
    (r'动漫|anime|mad|番剧', ['动漫场景']),
    (r'游戏|game', ['游戏场景']),

    # 动作类型
    (r'打斗|战斗|格斗|枪战|肉搏', ['打斗场景', '动态场景']),
    (r'奔跑|跑步|冲刺|追逐', ['奔跑', '动态场景']),
    (r'行走|走路|漫步', ['行走']),
    (r'对话|交谈|说话', ['对话交流']),

    # 情绪/氛围
    (r'流泪|哭泣|悲伤|伤心', ['悲伤情绪']),
    (r'愤怒|生气|怒', ['愤怒情绪']),
    (r'开心|快乐|笑|喜悦', ['快乐情绪']),
    (r'恐惧|害怕|惊恐', ['恐惧情绪']),
    (r'紧张|焦虑', ['紧张情绪']),

    # 镜头类型
    (r'特写|面部|脸部|眼睛', ['特写镜头', '面部特写']),
    (r'全景|远景|大景', ['全景镜头']),
    (r'近景', ['近景镜头']),

    # 特殊场景
    (r'自然|风景|山|海|森林|天空', ['自然风景', '室外场景']),
    (r'黄昏|夕阳|傍晚', ['黄昏']),
    (r'清晨|早晨|日出', ['清晨']),
]

# 要移除的泛化标签（没有区分度）
REMOVE_TAGS = {'办公室', '工作场所'}


def extract_tags_from_path(file_path: str) -> list:
    """从文件路径提取标签"""
    tags = set()
    path_lower = file_path.lower()

    for pattern, tag_list in PATH_TAG_RULES:
        if re.search(pattern, path_lower, re.IGNORECASE):
            tags.update(tag_list)

    return list(tags)


def fix_tags(data: list) -> tuple:
    """修复标签"""
    stats = {
        'total': len(data),
        'modified': 0,
        'tags_removed': 0,
        'tags_added': 0,
    }

    for item in data:
        if not item.get('clipMetadata'):
            continue

        old_tags = set(item['clipMetadata'].get('tags', []))
        new_tags = old_tags.copy()

        # 1. 移除泛化标签
        removed = new_tags & REMOVE_TAGS
        new_tags -= REMOVE_TAGS
        stats['tags_removed'] += len(removed)

        # 2. 基于文件路径添加标签
        path_tags = extract_tags_from_path(item.get('filePath', ''))
        added = set(path_tags) - new_tags
        new_tags.update(path_tags)
        stats['tags_added'] += len(added)

        # 3. 确保至少有基础标签
        if not new_tags:
            new_tags.add('未分类')

        # 更新
        if new_tags != old_tags:
            item['clipMetadata']['tags'] = list(new_tags)
            stats['modified'] += 1

    return data, stats


def main():
    print('加载 clip_results.json...')
    with open('clip_results.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f'总素材数: {len(data)}')

    # 修复标签
    print('\n修复标签中...')
    data, stats = fix_tags(data)

    print(f'\n修复统计:')
    print(f'  修改素材数: {stats["modified"]}')
    print(f'  移除标签数: {stats["tags_removed"]}')
    print(f'  新增标签数: {stats["tags_added"]}')

    # 分析新标签分布
    tag_counter = Counter()
    for item in data:
        if item.get('clipMetadata') and 'tags' in item['clipMetadata']:
            for tag in item['clipMetadata']['tags']:
                tag_counter[tag] += 1

    print(f'\n新标签分布 (Top 20):')
    for tag, count in tag_counter.most_common(20):
        pct = count / len(data) * 100
        print(f'  {tag}: {count} ({pct:.1f}%)')

    # 保存
    print('\n保存到 clip_results.json...')
    with open('clip_results.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print('完成!')


if __name__ == '__main__':
    main()
