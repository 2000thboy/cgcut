/**
 * CLIP 处理状态
 */
export type CLIPProcessStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

/**
 * CLIP 元数据
 */
export interface CLIPMetadata {
  embeddings: number[]; // CLIP 特征向量
  tags: string[]; // 自动生成的标签
  description: string; // 场景描述
  emotions: string[]; // 识别到的情绪
  keyframes?: string[]; // 关键帧截图路径
  processed_at: string; // 处理时间
  model_version: string; // CLIP 模型版本
}

/**
 * VLM 元数据（视觉语言模型生成的自然语言描述）
 */
export interface VLMMetadata {
  description: string; // 自然语言描述
  model: string; // 使用的模型 (MiniMind-V / CLIP-based)
  processed_at: string; // 处理时间
}

/**
 * 搜索模式
 */
export type SearchMode = 'tags' | 'semantic' | 'hybrid';

/**
 * 搜索请求
 */
export interface SearchRequest {
  query: string; // 搜索关键词
  mode: SearchMode; // 搜索模式
  filters?: {
    shot_type?: string[]; // 景别筛选
    scene?: string[]; // 场景筛选
    emotion?: string[]; // 情绪筛选
  };
  limit?: number; // 返回数量限制
}

/**
 * 搜索结果
 */
export interface SearchResult {
  shot_id: string;
  score: number; // 匹配分数
  match_type: 'tag' | 'semantic' | 'both'; // 匹配类型
}

/**
 * CLIP 扫描请求
 */
export interface CLIPScanRequest {
  directoryPath: string; // 扫描目录
  filePatterns?: string[]; // 文件匹配模式 (默认: ['*.mp4', '*.mov', '*.avi'])
  skipProcessed?: boolean; // 跳过已处理的文件
  extractKeyframes?: boolean; // 是否提取关键帧
}

/**
 * CLIP 处理响应
 */
export interface CLIPProcessResponse {
  status: 'success' | 'error';
  processedFiles: {
    filePath: string;
    shotId: string;
    clipMetadata: CLIPMetadata;
    status: 'success' | 'error';
    error?: string;
  }[];
  summary: {
    totalFiles: number;
    processed: number;
    skipped: number;
    failed: number;
    processingTime: number; // 毫秒
  };
  error?: string;
}

// 验收相关类型（轻量占位，便于调用验收服务）
export interface AcceptanceStoryboardItem {
  id: string;
  text: string;
  duration?: number;
  emotion?: string;
}

export interface AcceptanceMatchItem {
  block_id: string;
  shot_id: string;
  confidence?: number;
  notes?: string;
}

export interface AcceptanceResponse {
  status: 'success' | 'error';
  passed: boolean;
  score?: number;
  issues?: string[];
  details?: any;
}

/**
 * LLM 处理状态
 */
export type LLMProcessStatus = 'idle' | 'analyzing' | 'success' | 'error';

/**
 * LLM 剧本拆解请求
 */
export interface LLMScriptAnalysisRequest {
  scriptContent: string; // 原始剧本内容
  fileName: string; // 文件名
  options?: {
    language?: string; // 语言 (zh/en)
    includeEmotions?: boolean; // 是否分析情绪
    estimateDuration?: boolean; // 是否估算时长
  };
}

/**
 * LLM 剧本拆解响应
 */
export interface LLMScriptAnalysisResponse {
  status: 'success' | 'error';
  scenes: ScriptScene[]; // 拆解后的场景列表
  blocks: ScriptBlock[]; // 拆解后的段落列表
  summary?: string; // 剧本摘要
  metadata?: {
    totalScenes: number; // 场景数
    totalBlocks: number; // 段落数
    estimatedDuration: number; // 预估总时长
    analysisTime: number; // 分析耗时(毫秒)
  };
  error?: string; // 错误信息
}

/**
 * 剧本场景（ScriptScene）
 * 表示剧本中的一个场景，包含多个段落
 */
export interface ScriptScene {
  id: string;
  name: string; // 场景名称（如 "INT. 卧室 - 夜晚"）
  blocks: ScriptBlock[]; // 场景下的段落列表
  collapsed?: boolean; // 是否折叠
}

/**
 * 剧本段落（ScriptBlock）
 * 表示剧本中的一个叙事单元
 */
export interface ScriptBlock {
  id: string;
  scene_id: string; // 所属场景 ID
  scene: string; // 场景标识（如 "INT. 卧室 - 夜晚"）
  text: string; // 段落台词或描述
  emotion: string; // 情绪标签（如 "紧张", "平静"）
  expected_duration: number; // 导演预期时长（秒）
  has_clip?: boolean; // 是否已有对应的clip
}

/**
 * 素材处理状态
 */
export type ShotStatus = 'pending' | 'processing' | 'ready' | 'error';

/**
 * 素材镜头（Shot）
 * 表示可用的素材镜头
 */
export interface Shot {
  id: string;
  label: string; // 镜头描述（如 "特写-手部"）
  emotion: string; // 情绪标签（用于筛选）
  duration: number; // 镜头时长（秒）
  file_path: string; // 视频文件路径（后端引用路径）
  status: ShotStatus; // 处理状态
  tags?: string[]; // 标签列表
  metadata?: {
    resolution?: string; // 分辨率
    fps?: number; // 帧率
    codec?: string; // 编码格式
    fileSize?: number; // 文件大小
  };
  clip_metadata?: CLIPMetadata; // CLIP 提取的结构化标签
  vlm_metadata?: VLMMetadata; // VLM 生成的自然语言描述
}

/**
 * 时间轴镜头实例（Clip）
 * 表示时间轴上的一个镜头实例
 */
export interface Clip {
  id: string;
  script_block_id: string; // 所属剧本段落 ID
  shot_id: string; // 绑定的 Shot ID
  trim_in: number; // 裁剪起始点（秒，相对于 Shot 原始时长）
  trim_out: number; // 裁剪结束点（秒，相对于 Shot 原始时长）
  duration: number; // 裁剪后的实际时长（trim_out - trim_in）
}

/**
 * 素材库配置
 */
export interface MediaLibraryConfig {
  base_path: string; // 素材库根路径
  total_files: number; // 总文件数
  processed_files: number; // 已处理文件数
  pending_files: number; // 待处理文件数
  last_scan_time?: string; // 最后扫描时间
}

/**
 * 服务器配置
 */
export interface Config {
  media_server_base_url: string; // 服务器素材根路径
  local_cache_path?: string; // 本地缓存目录（可选）
  preview_quality?: 'low' | 'medium' | 'high'; // 预览视频质量
  media_library?: MediaLibraryConfig; // 素材库配置
}

/**
 * 项目检查状态
 */
export interface ProjectCheckStatus {
  hasScript: boolean; // 是否有剧本
  scriptSegmented: boolean; // 剧本是否已分段
  allBlocksHaveClips: boolean; // 所有段落是否都有clip
  allClipsHaveShots: boolean; // 所有clip是否都有对应素材
  missingBlocks: string[]; // 缺少clip的段落ID
  missingShots: string[]; // 缺少素材的clipID
  readyToPlay: boolean; // 是否可以播放
}

/**
 * 播放状态
 */
export interface PlaybackState {
  current_time: number; // 当前播放时间（秒，相对于时间轴起点）
  is_playing: boolean; // 播放/暂停状态
  current_clip_index: number; // 当前播放的 Clip 索引
  current_clip_internal_time: number; // 当前 Clip 内部播放时间（考虑 trim_in）
  current_script_block_id: string | null; // 当前对应的 ScriptBlock ID
}

/**
 * 计算 ScriptBlock 的实际时长
 */
export function calculateScriptBlockDuration(
  scriptBlockId: string,
  clips: Clip[]
): number {
  return clips
    .filter(clip => clip.script_block_id === scriptBlockId)
    .reduce((sum, clip) => sum + clip.duration, 0);
}

/**
 * 计算时间轴总时长
 */
export function calculateTotalDuration(clips: Clip[]): number {
  return clips.reduce((sum, clip) => sum + clip.duration, 0);
}

/**
 * 根据当前播放时间查找对应的 Clip
 */
export function findClipAtTime(
  currentTime: number,
  clips: Clip[]
): { clip: Clip; index: number; internalTime: number } | null {
  let accumulatedTime = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const startTime = accumulatedTime;
    const endTime = accumulatedTime + clip.duration;

    if (currentTime >= startTime && currentTime < endTime) {
      const internalTime = (currentTime - startTime) + clip.trim_in;
      return { clip, index: i, internalTime };
    }

    accumulatedTime += clip.duration;
  }

  return null;
}

/**
 * 创建新的 Clip 实例
 */
export function createClip(
  scriptBlockId: string,
  shot: Shot
): Clip {
  return {
    id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    script_block_id: scriptBlockId,
    shot_id: shot.id,
    trim_in: 0,
    trim_out: shot.duration,
    duration: shot.duration,
  };
}

/**
 * 更新 Clip 的裁剪参数
 */
export function updateClipTrim(
  clip: Clip,
  trimIn: number,
  trimOut: number
): Clip {
  // 确保裁剪范围有效
  const validTrimIn = Math.max(0, trimIn);
  const validTrimOut = Math.max(validTrimIn + 0.1, trimOut);

  return {
    ...clip,
    trim_in: validTrimIn,
    trim_out: validTrimOut,
    duration: validTrimOut - validTrimIn,
  };
}

/**
 * 替换 Clip 的 Shot
 */
export function replaceClipShot(
  clip: Clip,
  newShot: Shot
): Clip {
  return {
    ...clip,
    shot_id: newShot.id,
    trim_in: 0,
    trim_out: newShot.duration,
    duration: newShot.duration,
  };
}
