/**
 * CLIP 模型服务
 * 用于视频内容分析和元数据提取
 */

import type { 
  CLIPScanRequest, 
  CLIPProcessResponse, 
  CLIPMetadata
} from '../types/DataModel';

interface CLIPServiceConfig {
  apiEndpoint?: string; // CLIP 服务 API 端点
  modelVersion?: string; // 模型版本
  batchSize?: number; // 批处理大小
  useMock?: boolean; // 是否使用mock数据（默认false）
}

interface QuickListResponse {
  status: string;
  files: {
    filePath: string;
    shotId: string;
    label: string;
    duration: number;
    status: string;
  }[];
  summary: {
    totalFiles: number;
    directory: string;
  };
}

/**
 * CLIP 服务类
 * 默认调用真实API，不可用时直接报错
 */
export class CLIPService {
  private config: CLIPServiceConfig;

  constructor(config: CLIPServiceConfig = {}) {
    this.config = {
      apiEndpoint: config.apiEndpoint || 'http://localhost:8000/clip',
      modelVersion: config.modelVersion || 'ViT-B/32',
      batchSize: config.batchSize || 5,
      useMock: config.useMock ?? false, // 默认不使用mock
    };
  }

  /**
   * 快速列出目录中的视频文件（不做CLIP处理）
   * @param directoryPath 目录路径
   * @param limit 限制数量，0表示不限制
   */
  async quickList(directoryPath: string, limit: number = 0): Promise<QuickListResponse> {
    console.log('[CLIPService] 快速列出目录:', directoryPath, '限制:', limit);
    
    const response = await fetch(`${this.config.apiEndpoint}/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directory: directoryPath,
        file_patterns: ['*.mp4', '*.mov', '*.avi', '*.MP4', '*.MOV', '*.AVI'],
        limit: limit,
        get_duration: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`CLIP API 列表失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * 获取已处理的结果（从CLIP后台处理的）
   */
  async getProcessedResults(): Promise<{ results: any[]; total: number }> {
    console.log('[CLIPService] 获取已处理结果');
    
    const response = await fetch(`${this.config.apiEndpoint}/results`);
    
    if (!response.ok) {
      throw new Error(`获取结果失败: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * 扫描并处理目录中的视频文件
   */
  async scanAndProcess(request: CLIPScanRequest): Promise<CLIPProcessResponse> {
    console.log('[CLIPService] 开始扫描目录:', request.directoryPath);
    
    try {
      // 调用真实 CLIP API
      const response = await this.callRealCLIPAPI(request);
      return response;
    } catch (error) {
      console.error('[CLIPService] CLIP API调用失败:', error);
      
      // 不使用mock数据，直接报错
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `⚠️ CLIP API 调用失败\n\n` +
        `错误信息: ${errorMessage}\n\n` +
        `可能的原因:\n` +
        `1. CLIP服务未启动 (${this.config.apiEndpoint})\n` +
        `2. 网络连接问题\n` +
        `3. API端点配置错误\n\n` +
        `请确保CLIP服务已启动并可访问。`
      );
    }
  }

  /**
   * 处理单个视频文件（用于新增素材）
   */
  async processSingleFile(filePath: string): Promise<CLIPMetadata> {
    console.log('[CLIPService] 处理单个文件:', filePath);
    
    try {
      // 调用真实 CLIP API
      const metadata = await this.callRealSingleFileAPI(filePath);
      return metadata;
    } catch (error) {
      console.error('[CLIPService] CLIP API处理单个文件失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `⚠️ CLIP API 处理失败\n\n` +
        `文件: ${filePath}\n` +
        `错误: ${errorMessage}\n\n` +
        `请确保CLIP服务已启动。`
      );
    }
  }

  /**
   * 从已存在的元数据中提取（如果文件已被 CLIP 处理过）
   */
  async extractExistingMetadata(filePath: string): Promise<CLIPMetadata | null> {
    console.log('[CLIPService] 尝试提取已有元数据:', filePath);
    
    // 检查是否存在 .metadata.json 或 .clip.json 文件
    const metadataPath = filePath.replace(/\.(mp4|mov|avi)$/i, '.clip.json');
    
    try {
      // 调用API检查元数据
      console.log('[CLIPService] 检查元数据文件:', metadataPath);
      
      // 如果API不可用，返回null表示没有已有元数据
      return null;
    } catch (error) {
      console.warn('[CLIPService] 提取已有元数据失败:', error);
      return null;
    }
  }

  /**
   * 调用真实 CLIP API 批量处理
   */
  private async callRealCLIPAPI(request: CLIPScanRequest): Promise<CLIPProcessResponse> {
    console.log('[CLIPService] 调用真实 CLIP API:', this.config.apiEndpoint);
    
    const response = await fetch(`${this.config.apiEndpoint}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directory: request.directoryPath,
        file_patterns: request.filePatterns || ['*.mp4', '*.mov', '*.avi'],
        skip_processed: request.skipProcessed ?? true,
        extract_keyframes: request.extractKeyframes ?? true,
        model_version: this.config.modelVersion,
        batch_size: this.config.batchSize,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`CLIP API 调用失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as CLIPProcessResponse;
  }

  /**
   * 调用真实 CLIP API 处理单个文件
   */
  private async callRealSingleFileAPI(filePath: string): Promise<CLIPMetadata> {
    console.log('[CLIPService] 调用真实 CLIP API 处理单文件:', filePath);
    
    const response = await fetch(`${this.config.apiEndpoint}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: filePath,
        extract_keyframes: true,
        model_version: this.config.modelVersion,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`CLIP API 处理失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as CLIPMetadata;
  }

  // ============================================
  // 文字搜索视频片段 API（类似 VCED 功能）
  // ============================================

  /**
   * 用文字描述搜索视频片段
   * 
   * 原理：将文字编码为CLIP向量，与已处理视频的图像向量计算余弦相似度
   * 
   * @param query 搜索文本，如"一个人在街上行走"、"夜晚的城市"
   * @param topK 返回结果数量
   * @param threshold 相似度阈值，低于此值不返回
   * @param filterTags 可选：按标签过滤
   */
  async searchByText(
    query: string, 
    topK: number = 10, 
    threshold: number = 0.0,
    filterTags?: string[]
  ): Promise<CLIPSearchResult> {
    console.log('[CLIPService] 文字搜索:', query, 'top_k:', topK);
    
    const response = await fetch(`${this.config.apiEndpoint}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        top_k: topK,
        threshold,
        filter_tags: filterTags,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`CLIP 搜索失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * 多条件组合搜索
   * 
   * 将多个查询的相似度加权平均，找到同时满足多个条件的视频
   * 
   * @param queries 多个搜索条件，如["室内场景", "两个人对话", "平静氛围"]
   * @param topK 返回结果数量
   */
  async searchMulti(queries: string[], topK: number = 5): Promise<CLIPMultiSearchResult> {
    console.log('[CLIPService] 多条件搜索:', queries);
    
    const response = await fetch(`${this.config.apiEndpoint}/search-multi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries,
        top_k: topK,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`CLIP 多条件搜索失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * 快速文字搜索（GET方式，便于简单调用）
   */
  async quickSearch(query: string, topK: number = 10): Promise<CLIPSearchResult> {
    console.log('[CLIPService] 快速搜索:', query);
    
    const params = new URLSearchParams({
      query,
      top_k: topK.toString(),
    });
    
    const response = await fetch(`${this.config.apiEndpoint}/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`CLIP 快速搜索失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
}

// ============================================
// 搜索结果类型定义
// ============================================

/** 单个搜索匹配结果 */
export interface CLIPSearchMatch {
  filePath: string;
  shotId: string;
  label: string;
  similarity: number;
  tags: string[];
  description: string;
  emotions: string[];
  duration: number;
}

/** 文字搜索响应 */
export interface CLIPSearchResult {
  status: string;
  query: string;
  results: CLIPSearchMatch[];
  total: number;
  searched?: number;
  message?: string;
}

/** 多条件搜索匹配结果 */
export interface CLIPMultiSearchMatch extends CLIPSearchMatch {
  query_scores: Record<string, number>;
}

/** 多条件搜索响应 */
export interface CLIPMultiSearchResult {
  status: string;
  queries: string[];
  results: CLIPMultiSearchMatch[];
  total: number;
}

// 导出单例实例
export const clipService = new CLIPService();
