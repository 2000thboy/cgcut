/**
 * 素材匹配服务
 * 
 * 核心功能：使用 CLIP 向量搜索为分镜段落匹配最佳素材
 * 
 * 匹配策略：
 * 1. 主要依靠 CLIP 向量搜索（文字描述 -> 视频向量相似度）
 * 2. 情绪标签作为辅助过滤条件
 * 3. 返回 top-N 候选素材供用户选择
 */

import { clipService, type CLIPSearchMatch } from './clipService';
import type { ScriptBlock, Shot } from '../types/DataModel';

/** 素材匹配结果 */
export interface AssetMatchResult {
  /** 匹配的素材ID */
  shotId: string;
  /** 素材文件路径 */
  filePath: string;
  /** 素材标签 */
  label: string;
  /** CLIP 相似度分数 (0-1) */
  similarity: number;
  /** 素材标签列表 */
  tags: string[];
  /** 素材描述 */
  description: string;
  /** 素材情绪 */
  emotions: string[];
  /** 素材时长 */
  duration: number;
  /** 匹配类型 */
  matchType: 'clip_vector' | 'emotion_tag' | 'fallback';
}

/** 批量匹配结果 */
export interface BatchMatchResult {
  blockId: string;
  blockText: string;
  candidates: AssetMatchResult[];
  bestMatch: AssetMatchResult | null;
  searchQuery: string;
}

/**
 * 素材匹配服务类
 */
export class AssetMatchingService {
  private clipServiceAvailable: boolean = true;

  /**
   * 为单个分镜段落匹配素材
   * 
   * @param block 分镜段落
   * @param topK 返回候选数量
   * @param localShots 本地素材列表（用于回退匹配）
   */
  async matchAssetForBlock(
    block: ScriptBlock,
    topK: number = 5,
    localShots: Shot[] = []
  ): Promise<AssetMatchResult[]> {
    console.log(`[AssetMatching] 为段落匹配素材: "${block.text.substring(0, 50)}..."`);

    // 1. 首先尝试 CLIP 向量搜索
    if (this.clipServiceAvailable) {
      try {
        const searchQuery = this.buildSearchQuery(block);
        console.log(`[AssetMatching] CLIP搜索查询: "${searchQuery}"`);

        const clipResult = await clipService.searchByText(searchQuery, topK, 0.1);
        
        if (clipResult.results && clipResult.results.length > 0) {
          console.log(`[AssetMatching] CLIP搜索返回 ${clipResult.results.length} 个结果`);
          return clipResult.results.map(match => this.convertClipMatch(match, 'clip_vector'));
        }
        
        console.log('[AssetMatching] CLIP搜索无结果，尝试情绪标签匹配');
      } catch (error) {
        console.warn('[AssetMatching] CLIP服务不可用:', error);
        this.clipServiceAvailable = false;
      }
    }

    // 2. 回退到情绪标签匹配
    return this.matchByEmotionTag(block, localShots, topK);
  }

  /**
   * 批量为多个分镜段落匹配素材
   */
  async batchMatchAssets(
    blocks: ScriptBlock[],
    topK: number = 3,
    localShots: Shot[] = []
  ): Promise<BatchMatchResult[]> {
    console.log(`[AssetMatching] 批量匹配 ${blocks.length} 个段落`);

    const results: BatchMatchResult[] = [];

    for (const block of blocks) {
      const searchQuery = this.buildSearchQuery(block);
      const candidates = await this.matchAssetForBlock(block, topK, localShots);

      results.push({
        blockId: block.id,
        blockText: block.text,
        candidates,
        bestMatch: candidates.length > 0 ? candidates[0] : null,
        searchQuery,
      });
    }

    return results;
  }

  /**
   * 构建 CLIP 搜索查询
   * 
   * 从分镜段落文本中提取关键信息，构建更精准的搜索查询
   */
  private buildSearchQuery(block: ScriptBlock): string {
    // 分镜文本通常格式为: [景别] 描述内容 | 情绪 | 时长
    // 我们需要提取描述内容部分
    
    let query = block.text;
    
    // 移除景别标记 [特写] [近景] 等
    query = query.replace(/\[([特近中全远]景?|特写)\]\s*/g, '');
    
    // 移除时长标记 (如 "3.5s" 或 "| 3.5秒")
    query = query.replace(/\|\s*[\d.]+s?秒?/g, '');
    
    // 移除情绪标记 (如 "| 紧张")
    query = query.replace(/\|\s*(紧张|焦虑|恐惧|释然|平静|愤怒|悲伤|喜悦|中性)/g, '');
    
    // 清理多余空格和分隔符
    query = query.replace(/\s*\|\s*/g, ' ').trim();
    
    // 如果处理后太短，使用原文
    if (query.length < 5) {
      query = block.text;
    }
    
    // 可选：添加情绪作为搜索增强
    if (block.emotion && block.emotion !== '平静' && block.emotion !== '中性') {
      query = `${query} ${block.emotion}氛围`;
    }
    
    return query;
  }

  /**
   * 转换 CLIP 搜索结果为统一格式
   */
  private convertClipMatch(match: CLIPSearchMatch, matchType: AssetMatchResult['matchType']): AssetMatchResult {
    return {
      shotId: match.shotId,
      filePath: match.filePath,
      label: match.label,
      similarity: match.similarity,
      tags: match.tags || [],
      description: match.description || '',
      emotions: match.emotions || [],
      duration: match.duration || 5.0,
      matchType,
    };
  }

  /**
   * 基于情绪标签的回退匹配
   */
  private matchByEmotionTag(
    block: ScriptBlock,
    localShots: Shot[],
    topK: number
  ): AssetMatchResult[] {
    console.log(`[AssetMatching] 使用情绪标签匹配: ${block.emotion}`);

    if (localShots.length === 0) {
      console.log('[AssetMatching] 无本地素材可匹配');
      return [];
    }

    // 按情绪匹配
    const emotionMatches = localShots.filter(shot => shot.emotion === block.emotion);
    
    // 如果没有精确匹配，返回所有素材
    const candidates = emotionMatches.length > 0 ? emotionMatches : localShots;

    return candidates.slice(0, topK).map((shot, index) => ({
      shotId: shot.id,
      filePath: shot.file_path,
      label: shot.label,
      similarity: emotionMatches.length > 0 ? 0.8 - index * 0.1 : 0.5 - index * 0.1,
      tags: shot.tags || [],
      description: shot.clip_metadata?.description || '',
      emotions: shot.clip_metadata?.emotions || [shot.emotion],
      duration: shot.duration,
      matchType: 'emotion_tag' as const,
    }));
  }

  /**
   * 重置 CLIP 服务可用状态（用于重试）
   */
  resetClipServiceStatus() {
    this.clipServiceAvailable = true;
  }

  /**
   * 检查 CLIP 服务是否可用
   */
  isClipServiceAvailable(): boolean {
    return this.clipServiceAvailable;
  }
}

// 导出单例实例
export const assetMatchingService = new AssetMatchingService();
