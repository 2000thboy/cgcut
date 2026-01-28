"""
标签修复脚本 - 最小版本
基于文件名关键词修正明显错误的"办公室"标签

修复策略：
1. 如果文件名包含动漫/战斗/游戏关键词 → 移除办公室标签，标记为"动漫场景"
2. 如果文件名包含街道/城市关键词 → 移除办公室标签，标记为"街道"
3. 如果文件名包含自然/风景关键词 → 移除办公室标签，标记为"自然风景"
4. 其他保持不变
"""
import json
import re
from pathlib import Path

# 关键词映射
KEYWORD_RULES = [
    # (关键词列表, 要移除的标签, 要添加的标签)
    (
        ['战斗', '打斗', '对决', '忍者', '佐助', '火影', '海贼', '进击', '鬼灭', '刀剑', '空之境界', '两仪式', 
         'fate', 'Fate', 'FATE', '动漫', '动画', '番剧', '漫画', 'anime', 'Anime'],
        ['办公室'],
        ['动漫场景']
    ),
    (
        ['游戏', 'game', 'Game', 'GAME', '甩鞋', '翻滚'],
        ['办公室'],
        ['游戏场景']
    ),
    (
        ['街道', '街头', '马路', '公路', '路口', '十字路口', '人行道'],
        ['办公室'],
        ['街道', '室外场景']
    ),
    (
        ['城市', '都市', '建筑', '大楼', '高楼', '天际线', 'city', 'City'],
        ['办公室'],
        ['城市', '室外场景']
    ),
    (
        ['自然', '风景', '山', '海', '森林', '树林', '草地', '天空', '云', '日落', '日出'],
        ['办公室'],
        ['自然风景', '室外场景']
    ),
    (
        ['夜晚', '夜景', '星空', '月亮', '灯光'],
        [],  # 不移除办公室（可能是办公室夜景）
        ['夜晚']
    ),
    (
        ['表情', '特写', '脸', '面部', '眼睛', '眼神'],
        [],  # 不移除办公室
        ['面部特写']
    ),
]


def fix_tags(item):
    """根据文件名关键词修复标签"""
    label = item.get('label', '')
    file_path = item.get('filePath', '')
    
    # 合并文件名和路径用于匹配
    text = f"{label} {Path(file_path).stem}"
    
    clip_meta = item.get('clipMetadata', {})
    tags = set(clip_meta.get('tags', []))
    
    modified = False
    
    for keywords, remove_tags, add_tags in KEYWORD_RULES:
        # 检查是否匹配任一关键词
        matched = any(kw.lower() in text.lower() for kw in keywords)
        
        if matched:
            # 移除指定标签
            for tag in remove_tags:
                if tag in tags:
                    tags.discard(tag)
                    modified = True
            
            # 添加新标签
            for tag in add_tags:
                if tag not in tags:
                    tags.add(tag)
                    modified = True
    
    if modified:
        clip_meta['tags'] = list(tags)
        
    return modified


def main(dry_run=True):
    # 加载数据
    with open('clip_results.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f'总素材数: {len(data)}')
    print(f'模式: {"预览(dry-run)" if dry_run else "实际修改"}')
    
    # 统计修复前的办公室标签数量
    before_office = sum(1 for item in data if '办公室' in item.get('clipMetadata', {}).get('tags', []))
    print(f'修复前"办公室"标签数: {before_office}')
    
    # 修复标签
    modified_count = 0
    modified_samples = []
    for item in data:
        old_tags = list(item.get('clipMetadata', {}).get('tags', []))
        if fix_tags(item):
            modified_count += 1
            new_tags = item.get('clipMetadata', {}).get('tags', [])
            if len(modified_samples) < 5:
                modified_samples.append({
                    'label': item.get('label', '')[:50],
                    'old': old_tags,
                    'new': new_tags
                })
    
    print(f'修改了 {modified_count} 个素材的标签')
    
    # 显示修改样本
    if modified_samples:
        print('\n修改样本:')
        for s in modified_samples:
            print(f'  {s["label"]}')
            print(f'    旧: {s["old"]}')
            print(f'    新: {s["new"]}')
    
    # 统计修复后的办公室标签数量
    after_office = sum(1 for item in data if '办公室' in item.get('clipMetadata', {}).get('tags', []))
    print(f'\n修复后"办公室"标签数: {after_office} (减少 {before_office - after_office})')
    
    # 统计新标签分布
    from collections import Counter
    all_tags = []
    for item in data:
        tags = item.get('clipMetadata', {}).get('tags', [])
        all_tags.extend(tags)
    
    tag_counts = Counter(all_tags)
    print('\n修复后标签分布 (前15):')
    for tag, count in tag_counts.most_common(15):
        print(f'  {tag}: {count}')
    
    if not dry_run:
        # 备份并保存
        import shutil
        backup_path = 'clip_results_backup.json'
        shutil.copy('clip_results.json', backup_path)
        print(f'\n已备份到: {backup_path}')
        
        with open('clip_results.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print('已保存修复后的标签')
    else:
        print('\n[dry-run模式] 未保存更改。使用 --apply 参数实际执行修改')


if __name__ == '__main__':
    import sys
    dry_run = '--apply' not in sys.argv
    main(dry_run=dry_run)
