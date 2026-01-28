#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量扫描脚本 - 重建 Chinese-CLIP 向量索引
"""

import requests
import json
import os
import time

def get_directory_structure(base_dir):
    """获取目录结构统计"""
    payload = {
        'directory': base_dir,
        'file_patterns': ['*.mp4'],
        'limit': 2000
    }
    
    try:
        response = requests.post('http://localhost:8000/clip/list', json=payload, timeout=30)
        if response.status_code == 200:
            data = response.json()
            files = data['files']
            
            # 按目录分组统计
            dir_stats = {}
            for file_info in files:
                dir_path = file_info['filePath']
                # 处理路径分隔符
                dir_path = dir_path.replace('\\\\', '\\')
                dir_name = os.path.dirname(dir_path).split('\\')[-1]
                if dir_name not in dir_stats:
                    dir_stats[dir_name] = 0
                dir_stats[dir_name] += 1
            
            return dir_stats, files
        else:
            print(f'列表请求失败: {response.status_code}')
            return {}, []
    except Exception as e:
        print(f'获取目录结构失败: {e}')
        return {}, []

def scan_directory(dir_name, base_dir):
    """扫描单个目录"""
    scan_payload = {
        'directory': rf'{base_dir}\\{dir_name}',
        'file_patterns': ['*.mp4', '*.mov', '*.avi', '*.mkv'],
        'extract_keyframes': True,
        'model_version': 'Chinese-CLIP ViT-B/16'
    }
    
    try:
        print(f'正在扫描目录: {dir_name}')
        response = requests.post('http://localhost:8000/clip/scan', json=scan_payload, timeout=600)
        
        if response.status_code == 200:
            result = response.json()
            processed_files = result.get('processedFiles', [])
            print(f'扫描完成，处理了 {len(processed_files)} 个文件')
            
            if processed_files:
                # 保存结果
                save_payload = {'results': processed_files}
                save_response = requests.post('http://localhost:8000/clip/save-results', json=save_payload, timeout=300)
                
                if save_response.status_code == 200:
                    print('结果保存成功')
                    return True, len(processed_files)
                else:
                    print(f'保存失败: {save_response.status_code}')
                    return False, 0
            else:
                print('没有处理任何文件')
                return True, 0
        else:
            print(f'扫描失败: {response.status_code} - {response.text[:200]}')
            return False, 0
            
    except Exception as e:
        print(f'扫描异常: {e}')
        return False, 0

def main():
    base_dir = r'U:\PreVis_Assets\originals\02类型-三渲二 二次元类'
    
    print('=== Chinese-CLIP 向量索引重建工具 ===')
    print(f'基础目录: {base_dir}')
    
    # 获取目录结构
    print('\n正在获取目录结构...')
    dir_stats, all_files = get_directory_structure(base_dir)
    
    if not dir_stats:
        print('无法获取目录结构，退出')
        return
    
    print(f'\n目录统计 (共 {len(dir_stats)} 个目录, {len(all_files)} 个文件):')
    sorted_dirs = sorted(dir_stats.items(), key=lambda x: x[1], reverse=True)
    
    for i, (dir_name, count) in enumerate(sorted_dirs[:10], 1):
        print(f'{i:2d}. {dir_name}: {count} 个文件')
    
    if len(sorted_dirs) > 10:
        print(f'... 还有 {len(sorted_dirs) - 10} 个目录')
    
    # 选择要处理的目录（跳过空目录）
    target_dirs = [dir_name for dir_name, count in sorted_dirs if count > 0]
    
    print(f'\n开始处理 {len(target_dirs)} 个目录...')
    
    processed_count = 0
    success_count = 0
    
    for i, dir_name in enumerate(target_dirs, 1):
        print(f'\n[{i}/{len(target_dirs)}] 处理目录: {dir_name}')
        
        success, file_count = scan_directory(dir_name, base_dir)
        
        if success:
            success_count += 1
            processed_count += file_count
            print(f'✅ 成功处理 {file_count} 个文件')
        else:
            print(f'❌ 处理失败')
        
        # 短暂休息，避免服务器过载
        time.sleep(2)
        
        # 检查当前总文件数
        try:
            with open('clip_results.json', 'r', encoding='utf-8') as f:
                current_data = json.load(f)
            print(f'当前总文件数: {len(current_data)}')
        except:
            pass
    
    print(f'\n=== 处理完成 ===')
    print(f'成功处理目录: {success_count}/{len(target_dirs)}')
    print(f'总共处理文件: {processed_count}')
    print(f'当前索引文件总数: {len(current_data)}')

if __name__ == '__main__':
    main()