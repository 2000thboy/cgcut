/**
 * \u6df7\u5408\u641c\u7d22\u670d\u52a1
 * \u652f\u6301\u4e09\u79cd\u641c\u7d22\u6a21\u5f0f\uff1a
 * - tags: \u57fa\u4e8eCLIP\u6807\u7b7e\u7684\u7cbe\u786e\u5339\u914d
 * - semantic: \u57fa\u4e8eVLM\u63cf\u8ff0\u7684\u8bed\u4e49\u641c\u7d22
 * - hybrid: \u6df7\u5408\u641c\u7d22\uff08\u7ed3\u5408\u4e24\u8005\uff09
 */

import type { Shot, SearchRequest, SearchResult } from '../types/DataModel';
import { clipService, type CLIPSearchResult } from './clipService';

/**
 * \u641c\u7d22\u670d\u52a1\u914d\u7f6e
 */
interface SearchServiceConfig {
  clipEndpoint: string; // CLIP\u670d\u52a1\u7aef\u70b9
  vlmEndpoint: string; // VLM\u670d\u52a1\u7aef\u70b9
  tagWeight: number; // \u6807\u7b7e\u5339\u914d\u6743\u91cd (0-1)
  semanticWeight: number; // \u8bed\u4e49\u5339\u914d\u6743\u91cd (0-1)
}

const DEFAULT_CONFIG: SearchServiceConfig = {
  clipEndpoint: 'http://localhost:8000',
  vlmEndpoint: 'http://localhost:8001',
  tagWeight: 0.6,
  semanticWeight: 0.4,
};

/**
 * \u6df7\u5408\u641c\u7d22\u670d\u52a1\u7c7b
 */
export class SearchService {
  private config: SearchServiceConfig;

  constructor(config?: Partial<SearchServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * \u6267\u884c\u641c\u7d22
   */
  async search(shots: Shot[], request: SearchRequest): Promise<SearchResult[]> {
    const { query, mode, filters, limit = 20 } = request;

    let results: SearchResult[] = [];

    switch (mode) {
      case 'tags':
        results = this.searchByTags(shots, query, filters);
        break;
      case 'semantic':
        results = await this.searchBySemantic(shots, query);
        break;
      case 'hybrid':
        results = await this.hybridSearch(shots, query, filters);
        break;
    }

    // \u6392\u5e8f\u5e76\u9650\u5236\u6570\u91cf
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * \u57fa\u4e8e\u6807\u7b7e\u7684\u641c\u7d22
   */
  searchByTags(shots: Shot[], query: string, filters?: SearchRequest['filters']): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    return shots
      .map(shot => {
        let score = 0;
        const allTags = [
          ...(shot.tags || []),
          ...(shot.clip_metadata?.tags || []),
          shot.label,
          shot.emotion,
        ].map(t => t?.toLowerCase() || '');

        // \u8ba1\u7b97\u6807\u7b7e\u5339\u914d\u5206\u6570
        for (const term of queryTerms) {
          for (const tag of allTags) {
            if (tag.includes(term)) {
              score += 1;
            }
            if (tag === term) {
              score += 0.5; // \u7cbe\u786e\u5339\u914d\u52a0\u5206
            }
          }
        }

        // \u5e94\u7528\u7b5b\u9009\u5668
        if (filters) {
          if (filters.emotion && !filters.emotion.includes(shot.emotion)) {
            score = 0;
          }
          if (filters.shot_type) {
            const shotType = shot.clip_metadata?.tags?.find(t => 
              t.includes('\u955c\u5934') || t.includes('\u7279\u5199') || t.includes('\u5168\u666f') || t.includes('\u4e2d\u666f') || t.includes('\u8fdc\u666f')
            );
            if (shotType && !filters.shot_type.some(f => shotType.includes(f))) {
              score = 0;
            }
          }
        }

        return {
          shot_id: shot.id,
          score,
          match_type: 'tag' as const,
        };
      })
      .filter(r => r.score > 0);
  }

  /**
   * \u57fa\u4e8e\u8bed\u4e49\u7684\u641c\u7d22\uff08\u4f7f\u7528VLM\u63cf\u8ff0\uff09
   */
  async searchBySemantic(shots: Shot[], query: string): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    return shots
      .map(shot => {
        let score = 0;
        
        // \u641c\u7d22VLM\u63cf\u8ff0
        const vlmDesc = shot.vlm_metadata?.description?.toLowerCase() || '';
        const clipDesc = shot.clip_metadata?.description?.toLowerCase() || '';
        const fullDesc = `${vlmDesc} ${clipDesc}`;

        // \u8ba1\u7b97\u8bed\u4e49\u5339\u914d\u5206\u6570
        for (const term of queryTerms) {
          if (fullDesc.includes(term)) {
            score += 1;
          }
        }

        // \u5982\u679c\u6709\u5b8c\u6574\u77ed\u8bed\u5339\u914d\uff0c\u52a0\u5206
        if (fullDesc.includes(queryLower)) {
          score += 2;
        }

        return {
          shot_id: shot.id,
          score,
          match_type: 'semantic' as const,
        };
      })
      .filter(r => r.score > 0);
  }

  /**
   * \u6df7\u5408\u641c\u7d22\uff08\u7ed3\u5408\u6807\u7b7e\u548c\u8bed\u4e49\uff09
   */
  async hybridSearch(shots: Shot[], query: string, filters?: SearchRequest['filters']): Promise<SearchResult[]> {
    // \u540c\u65f6\u6267\u884c\u4e24\u79cd\u641c\u7d22
    const [tagResults, semanticResults] = await Promise.all([
      this.searchByTags(shots, query, filters),
      this.searchBySemantic(shots, query),
    ]);

    // \u5408\u5e76\u7ed3\u679c
    const mergedMap = new Map<string, SearchResult>();

    // \u6dfb\u52a0\u6807\u7b7e\u641c\u7d22\u7ed3\u679c
    for (const result of tagResults) {
      mergedMap.set(result.shot_id, {
        shot_id: result.shot_id,
        score: result.score * this.config.tagWeight,
        match_type: 'tag',
      });
    }

    // \u6dfb\u52a0\u8bed\u4e49\u641c\u7d22\u7ed3\u679c
    for (const result of semanticResults) {
      const existing = mergedMap.get(result.shot_id);
      if (existing) {
        // \u4e24\u8005\u90fd\u5339\u914d\uff0c\u5408\u5e76\u5206\u6570
        existing.score += result.score * this.config.semanticWeight;
        existing.match_type = 'both';
      } else {
        mergedMap.set(result.shot_id, {
          shot_id: result.shot_id,
          score: result.score * this.config.semanticWeight,
          match_type: 'semantic',
        });
      }
    }

    return Array.from(mergedMap.values());
  }

  /**
   * 获取搜索建议（基于已有标签）
   */
  getSuggestions(shots: Shot[]): string[] {
    const tagSet = new Set<string>();

    for (const shot of shots) {
      // 收集所有标签
      shot.tags?.forEach(t => tagSet.add(t));
      shot.clip_metadata?.tags?.forEach(t => tagSet.add(t));
      if (shot.emotion) tagSet.add(shot.emotion);
    }

    return Array.from(tagSet).slice(0, 50); // 最多返回50个建议
  }

  // ============================================
  // CLIP 向量搜索（类似 VCED 功能）
  // ============================================

  /**
   * 基于 CLIP 向量的文字搜索
   * 
   * 这是核心的跨模态搜索功能，类似 VCED 项目的能力：
   * - 将用户输入的文字编码为 CLIP 向量
   * - 与已处理视频的图像向量计算余弦相似度
   * - 返回最相似的视频片段
   * 
   * @param query 自然语言查询，如"一个人在街上行走"、"夜晚的城市灯光"
   * @param topK 返回结果数量
   * @param threshold 相似度阈值
   */
  async searchByClipVector(query: string, topK: number = 10, threshold: number = 0.0): Promise<CLIPSearchResult> {
    console.log('[SearchService] CLIP向量搜索:', query);
    
    try {
      const result = await clipService.searchByText(query, topK, threshold);
      return result;
    } catch (error) {
      console.error('[SearchService] CLIP向量搜索失败:', error);
      throw error;
    }
  }

  /**
   * 多条件 CLIP 向量搜索
   * 
   * 同时满足多个条件的搜索，如：
   * - ["室内场景", "两个人对话", "平静氛围"]
   * - ["夜晚", "城市街道", "霓虹灯"]
   */
  async searchByClipMulti(queries: string[], topK: number = 5) {
    console.log('[SearchService] CLIP多条件搜索:', queries);
    
    try {
      const result = await clipService.searchMulti(queries, topK);
      return result;
    } catch (error) {
      console.error('[SearchService] CLIP多条件搜索失败:', error);
      throw error;
    }
  }

  /**
   * 智能搜索：自动选择最佳搜索策略
   * 
   * 根据查询内容自动判断使用哪种搜索方式：
   * - 短查询（<3字）：使用标签搜索
   * - 长查询或描述性语句：使用 CLIP 向量搜索
   * - 包含特定标签关键词：使用标签搜索
   */
  async smartSearch(shots: Shot[], query: string, limit: number = 20): Promise<{
    results: SearchResult[];
    clipResults?: CLIPSearchResult;
    strategy: 'tags' | 'clip' | 'hybrid';
  }> {
    const queryLower = query.toLowerCase();
    
    // 判断是否为标签类查询
    const tagKeywords = ['特写', '近景', '中景', '全景', '远景', '室内', '室外', 
                         '人物', '紧张', '平静', '快乐', '悲伤', '白天', '夜晚'];
    const isTagQuery = tagKeywords.some(kw => queryLower.includes(kw));
    
    // 短查询或标签查询：使用标签搜索
    if (query.length < 3 || isTagQuery) {
      const results = this.searchByTags(shots, query);
      return {
        results: results.slice(0, limit),
        strategy: 'tags',
      };
    }
    
    // 长查询或描述性语句：使用 CLIP 向量搜索
    try {
      const clipResults = await this.searchByClipVector(query, limit);
      
      // 将 CLIP 结果转换为 SearchResult 格式
      const results: SearchResult[] = clipResults.results.map(match => ({
        shot_id: match.shotId,
        score: match.similarity,
        match_type: 'semantic' as const,
      }));
      
      return {
        results,
        clipResults,
        strategy: 'clip',
      };
    } catch (error) {
      // CLIP 服务不可用时，回退到本地搜索
      console.warn('[SearchService] CLIP服务不可用，回退到本地搜索');
      const results = await this.hybridSearch(shots, query);
      return {
        results: results.slice(0, limit),
        strategy: 'hybrid',
      };
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SearchServiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): SearchServiceConfig {
    return { ...this.config };
  }
}

/**
 * 单例实例
 */
export const searchService = new SearchService();
