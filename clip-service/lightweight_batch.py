#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
轻量级批量扫描脚本 - 逐个目录处理
"""

import requests
import json
import time

def process_single_directory(dir_name, base_dir):
    """处理单个目录"""
    scan_payload = {
        'directory': rf'{base_dir}\\{dir_name}',
        'file_patterns': ['*.mp4', '*.mov', '*.avi', '*.mkv'],
        'extract_keyframes': True
    }
    
    try:
        print(f'扫描目录: {dir_name}')
        response = requests.post('http://localhost:8000/clip/scan', json=scan_payload, timeout=300)
        
        if response.status_code == 200:
            result = response.json()
            processed_files = result.get('processedFiles', [])
            print(f'处理了 {len(processed_files)} 个文件')
            
            if processed_files:
                # 保存结果
                save_payload = {'results': processed_files}
                save_response = requests.post('http://localhost:8000/clip/save-results', json=save_payload, timeout=60)
                
                if save_response.status_code == 200:
                    print('✅ 保存成功')
                    return True, len(processed_files)
                else:
                    print(f'❌ 保存失败: {save_response.status_code}')
                    return False, 0
            else:
                print('⚠️ 没有处理文件')
                return True, 0
        else:
            print(f'❌ 扫描失败: {response.status_code}')
            return False, 0
            
    except Exception as e:
        print(f'❌ 异常: {e}')
        return False, 0

def main():
    base_dir = r'U:\PreVis_Assets\originals\02类型-三渲二 二次元类'
    
    # 手动指定要处理的目录（从之前的大目录中选择）
    # 选择文件数量适中的目录进行测试
    target_dirs = [
        '1.动漫游戏SEASON片段1',
        '1.动漫游戏SEASON片段2', 
        '2.动漫游戏SEASON片段1',
        '2.动漫游戏SEASON片段2'
    ]
    
    print('=== Chinese-CLIP 索引重建（轻量版）===')
    print(f'基础目录: {base_dir}')
    print(f'计划处理 {len(target_dirs)} 个目录')
    
    total_files = 0
    success_count = 0
    
    for i, dir_name in enumerate(target_dirs, 1):
        print(f'\n[{i}/{len(target_dirs)}] 开始处理: {dir_name}')
        
        success, file_count = process_single_directory(dir_name, base_dir)
        
        if success:
            success_count += 1
            total_files += file_count
            print(f'✅ 成功，处理了 {file_count} 个文件')
        else:
            print(f'❌ 失败')
        
        # 短暂休息
        time.sleep(3)
        
        # 显示当前总文件数
        try:
            with open('clip_results.json', 'r', encoding='utf-8') as f:
                current_data = json.load(f)
            print(f'当前总文件数: {len(current_data)}')
        except:
            print('无法读取当前文件数')
    
    print(f'\n=== 处理总结 ===')
    print(f'成功目录: {success_count}/{len(target_dirs)}')
    print(f'处理文件总数: {total_files}')

if __name__ == '__main__':
    main()