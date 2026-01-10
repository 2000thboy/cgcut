import React, { useEffect, useRef, useState } from 'react';
import { ScriptBlock } from '../types/DataModel';
import { useAppStore } from '../store/appStore';
import { assetMatchingService, type AssetMatchResult } from '../services/assetMatchingService';

interface ScriptBlockPanelProps {
  className?: string;
}

export const ScriptBlockPanel: React.FC<ScriptBlockPanelProps> = ({ className }) => {
  const scriptBlocks = useAppStore(state => state.scriptBlocks);
  const scriptScenes = useAppStore(state => state.scriptScenes);
  const setScriptScenes = useAppStore(state => state.setScriptScenes);
  const originalScriptContent = useAppStore(state => state.originalScriptContent);
  const clips = useAppStore(state => state.clips);
  const highlightedScriptBlockId = useAppStore(state => state.highlightedScriptBlockId);
  const playbackState = useAppStore(state => state.playbackState);
  const getScriptBlockActualDuration = useAppStore(state => state.getScriptBlockActualDuration);
  const addClip = useAppStore(state => state.addClip);
  const shots = useAppStore(state => state.shots);
  
  const highlightedRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'parsed'>('parsed'); // 新增：Tab 状态
  const [matchingBlockId, setMatchingBlockId] = useState<string | null>(null); // 正在匹配的段落
  const [matchCandidates, setMatchCandidates] = useState<Record<string, AssetMatchResult[]>>({}); // 匹配候选
  const [isBatchMatching, setIsBatchMatching] = useState(false); // 批量匹配状态
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 }); // 批量匹配进度
  
  // 调试日志
  useEffect(() => {
    console.log('ScriptBlockPanel - scriptBlocks:', scriptBlocks.length);
    console.log('ScriptBlockPanel - scriptScenes:', scriptScenes.length);
    console.log('ScriptBlockPanel - scriptScenes data:', scriptScenes);
  }, [scriptBlocks, scriptScenes]);
  
  // 自动滚动到高亮段落
  useEffect(() => {
    if (highlightedRef.current && highlightedScriptBlockId) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedScriptBlockId]);
  
  // 根据播放时间查找当前段落
  const getCurrentBlockId = () => {
    let accumulatedTime = 0;
    for (const clip of clips) {
      const endTime = accumulatedTime + clip.duration;
      if (playbackState.current_time >= accumulatedTime && playbackState.current_time < endTime) {
        return clip.script_block_id;
      }
      accumulatedTime += clip.duration;
    }
    return null;
  };
  
  const currentPlayingBlockId = playbackState.is_playing ? getCurrentBlockId() : highlightedScriptBlockId;

  const getDurationStatus = (block: ScriptBlock) => {
    const actualDuration = getScriptBlockActualDuration(block.id);
    const expected = block.expected_duration;
    
    if (actualDuration === 0) return { status: 'empty', color: 'text-gray-500', hasClip: false };
    if (actualDuration > expected * 1.2) return { status: 'too-long', color: 'text-orange-400', hasClip: true };
    if (actualDuration < expected * 0.8) return { status: 'too-short', color: 'text-blue-400', hasClip: true };
    return { status: 'ok', color: 'text-green-400', hasClip: true };
  };
  
  // 折叠/展开场景
  const toggleSceneCollapse = (sceneId: string) => {
    const updatedScenes = scriptScenes.map(scene => 
      scene.id === sceneId ? { ...scene, collapsed: !scene.collapsed } : scene
    );
    setScriptScenes(updatedScenes);
  };
  
  // 为段落创建占位clip（使用CLIP向量搜索匹配素材）
  const createPlaceholderClip = async (blockId: string) => {
    const block = scriptBlocks.find(b => b.id === blockId);
    if (!block) return;
    
    setMatchingBlockId(blockId);
    
    try {
      // 使用 CLIP 向量搜索匹配素材
      const candidates = await assetMatchingService.matchAssetForBlock(block, 5, shots);
      
      // 保存候选结果供用户选择
      setMatchCandidates(prev => ({ ...prev, [blockId]: candidates }));
      
      if (candidates.length > 0) {
        // 自动选择最佳匹配
        const bestMatch = candidates[0];
        console.log(`[ScriptBlockPanel] 最佳匹配: ${bestMatch.label} (相似度: ${bestMatch.similarity.toFixed(3)})`);
        
        // 检查是否已有对应的 shot
        let shotId = bestMatch.shotId;
        const existingShot = shots.find(s => s.id === shotId || s.file_path === bestMatch.filePath);
        
        if (!existingShot) {
          // 创建新的 shot
          const newShot = {
            id: shotId || `shot_${Date.now()}`,
            label: bestMatch.label,
            emotion: bestMatch.emotions[0] || block.emotion,
            duration: bestMatch.duration,
            file_path: bestMatch.filePath,
            status: 'ready' as const,
            tags: bestMatch.tags,
          };
          useAppStore.getState().addShot(newShot);
          shotId = newShot.id;
        } else {
          shotId = existingShot.id;
        }
        
        addClip({
          id: `clip_${Date.now()}`,
          script_block_id: blockId,
          shot_id: shotId,
          trim_in: 0,
          trim_out: Math.min(block.expected_duration, bestMatch.duration),
          duration: Math.min(block.expected_duration, bestMatch.duration),
        });
      } else {
        // 无匹配结果，创建纯占位符
        const placeholderShot = {
          id: `placeholder_shot_${Date.now()}`,
          label: `占位符 - ${block.emotion}`,
          emotion: block.emotion,
          duration: block.expected_duration,
          file_path: '',
          status: 'pending' as const,
          tags: ['占位符', '待匹配'],
        };
        useAppStore.getState().addShot(placeholderShot);
        
        addClip({
          id: `clip_${Date.now()}`,
          script_block_id: blockId,
          shot_id: placeholderShot.id,
          trim_in: 0,
          trim_out: block.expected_duration,
          duration: block.expected_duration,
        });
      }
    } catch (error) {
      console.error('[ScriptBlockPanel] 素材匹配失败:', error);
      // 回退到简单匹配
      const matchingShot = shots.find(s => s.emotion === block.emotion) || shots[0];
      
      let shotId: string;
      if (!matchingShot) {
        const placeholderShot = {
          id: `placeholder_shot_${Date.now()}`,
          label: `占位符 - ${block.emotion}`,
          emotion: block.emotion,
          duration: block.expected_duration,
          file_path: '',
          status: 'pending' as const,
          tags: ['占位符'],
        };
        useAppStore.getState().addShot(placeholderShot);
        shotId = placeholderShot.id;
      } else {
        shotId = matchingShot.id;
      }
      
      addClip({
        id: `clip_${Date.now()}`,
        script_block_id: blockId,
        shot_id: shotId,
        trim_in: 0,
        trim_out: block.expected_duration,
        duration: block.expected_duration,
      });
    } finally {
      setMatchingBlockId(null);
    }
  };

  // 批量为所有未匹配的段落匹配素材
  const batchMatchAllBlocks = async () => {
    const unmatchedBlocks = scriptBlocks.filter(
      block => !clips.some(c => c.script_block_id === block.id)
    );
    
    if (unmatchedBlocks.length === 0) {
      console.log('[ScriptBlockPanel] 所有段落已匹配');
      return;
    }
    
    setIsBatchMatching(true);
    setBatchProgress({ current: 0, total: unmatchedBlocks.length });
    
    console.log(`[ScriptBlockPanel] 开始批量匹配 ${unmatchedBlocks.length} 个段落`);
    
    for (let i = 0; i < unmatchedBlocks.length; i++) {
      const block = unmatchedBlocks[i];
      setBatchProgress({ current: i + 1, total: unmatchedBlocks.length });
      
      try {
        await createPlaceholderClip(block.id);
        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`[ScriptBlockPanel] 匹配段落 ${block.id} 失败:`, error);
      }
    }
    
    setIsBatchMatching(false);
    console.log('[ScriptBlockPanel] 批量匹配完成');
  };
  
  // 渲染单个段落
  const renderBlock = (block: ScriptBlock, isNested: boolean = false) => {
    const actualDuration = getScriptBlockActualDuration(block.id);
    const durationStatus = getDurationStatus(block);
    const isHighlighted = currentPlayingBlockId === block.id;
    const hasClip = clips.some(c => c.script_block_id === block.id);
    const isMatching = matchingBlockId === block.id;
    const candidates = matchCandidates[block.id] || [];
    
    // 获取当前段落关联的 shot 信息
    const linkedClip = clips.find(c => c.script_block_id === block.id);
    const linkedShot = linkedClip ? shots.find(s => s.id === linkedClip.shot_id) : null;
    
    return (
      <div
        key={block.id}
        ref={isHighlighted ? highlightedRef : null}
        className={`
          border rounded-lg p-3 transition-all cursor-pointer
          ${isHighlighted ? 'bg-yellow-900 border-yellow-500 ring-2 ring-yellow-400' : 'bg-gray-750 border-gray-600'}
          ${isNested ? 'ml-4' : ''}
          hover:shadow-md hover:bg-gray-700
        `}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            {!isNested && (
              <div className="font-semibold text-sm text-gray-200 mb-1">{block.scene}</div>
            )}
            <div className="text-sm text-gray-400 line-clamp-2">{block.text}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`text-xs px-2 py-1 rounded ${
              block.emotion === '紧张' ? 'bg-red-900 text-red-200' :
              block.emotion === '焦虑' ? 'bg-orange-900 text-orange-200' :
              block.emotion === '恐惧' ? 'bg-purple-900 text-purple-200' :
              block.emotion === '释然' ? 'bg-green-900 text-green-200' :
              'bg-gray-700 text-gray-300'
            }`}>
              {block.emotion}
            </div>
            {!hasClip && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createPlaceholderClip(block.id);
                }}
                disabled={isMatching}
                className={`text-xs px-2 py-1 rounded ${
                  isMatching 
                    ? 'bg-gray-600 text-gray-400 cursor-wait' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isMatching ? '🔍 匹配中...' : '+ 智能匹配'}
              </button>
            )}
          </div>
        </div>
        
        {/* 显示已匹配的素材信息 */}
        {linkedShot && (
          <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-400">✓ 已匹配:</span>
              <span className="text-gray-300 font-medium">{linkedShot.label}</span>
            </div>
            {linkedShot.clip_metadata?.tags && linkedShot.clip_metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {linkedShot.clip_metadata.tags.slice(0, 4).map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {linkedShot.clip_metadata?.description && (
              <div className="text-gray-500 mt-1 line-clamp-1">
                {linkedShot.clip_metadata.description}
              </div>
            )}
          </div>
        )}
        
        {/* 显示匹配候选（如果有多个） */}
        {candidates.length > 1 && !hasClip && (
          <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
            <div className="text-gray-400 mb-1">候选素材 ({candidates.length}):</div>
            <div className="space-y-1">
              {candidates.slice(0, 3).map((candidate, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-1 hover:bg-gray-700 rounded cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: 允许用户选择候选素材
                  }}
                >
                  <span className="text-gray-300">{candidate.label}</span>
                  <span className={`${
                    candidate.similarity > 0.3 ? 'text-green-400' : 
                    candidate.similarity > 0.2 ? 'text-yellow-400' : 'text-gray-500'
                  }`}>
                    {(candidate.similarity * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs mt-2">
          <div>
            <span className="text-gray-500">期望: </span>
            <span className="font-medium text-gray-300">{block.expected_duration.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-gray-500">实际: </span>
            <span className={`font-medium ${durationStatus.color}`}>
              {actualDuration.toFixed(1)}s
            </span>
          </div>
          {actualDuration > 0 && (
            <div className={`font-medium ${durationStatus.color}`}>
              {actualDuration > block.expected_duration ? '+' : ''}
              {(actualDuration - block.expected_duration).toFixed(1)}s
            </div>
          )}
          {hasClip ? (
            <span className="text-green-400">✓</span>
          ) : (
            <span className="text-gray-500">○</span>
          )}
        </div>
      </div>
    );
  };
  
  // 如果有场景分组，渲染层级结构
  if (scriptScenes.length > 0) {
    return (
      <div className={`flex flex-col bg-gray-800 ${className || ''}`}>
        {/* TAB 切换按钮 */}
        <div className="flex border-b border-gray-700 bg-gray-750">
          <button
            onClick={() => setActiveTab('original')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'original'
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            📜 原文
          </button>
          <button
            onClick={() => setActiveTab('parsed')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'parsed'
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            🧩 LLM拆解 ({scriptBlocks.length}段)
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'original' ? (
            /* 原文显示 */
            <div className="h-full overflow-y-auto p-4">
              <h2 className="text-lg font-bold mb-2 text-gray-100">原始剧本</h2>
              {originalScriptContent ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {originalScriptContent}
                </pre>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-4">📜</div>
                  <div>请先导入剧本文件</div>
                </div>
              )}
            </div>
          ) : (
            /* LLM 拆解结果 */
            <div className="flex flex-col gap-2 p-4 overflow-y-auto h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-100">剧本段落</h2>
                {/* 批量匹配按钮 */}
                {scriptBlocks.some(b => !clips.some(c => c.script_block_id === b.id)) && (
                  <button
                    onClick={batchMatchAllBlocks}
                    disabled={isBatchMatching}
                    className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 ${
                      isBatchMatching
                        ? 'bg-gray-600 text-gray-400 cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isBatchMatching ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        匹配中 {batchProgress.current}/{batchProgress.total}
                      </>
                    ) : (
                      <>🎯 一键智能匹配</>
                    )}
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                {scriptBlocks.length} 个段落 · {scriptScenes.length} 个场景
                {clips.length > 0 && ` · ${clips.length} 个已匹配`}
              </div>
              
              {scriptScenes.map(scene => (
                <div key={scene.id} className="mb-2">
                  {/* 场景标题 */}
                  <div
                    onClick={() => toggleSceneCollapse(scene.id)}
                    className="flex items-center gap-2 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-650"
                  >
                    <span className="text-gray-400">
                      {scene.collapsed ? '▶' : '▼'}
                    </span>
                    <span className="text-gray-200 font-medium flex-1">{scene.name}</span>
                    <span className="text-xs text-gray-500">
                      {scene.blocks.length} 段
                    </span>
                  </div>
                  
                  {/* 场景下的段落 */}
                  {!scene.collapsed && (
                    <div className="mt-2 space-y-2">
                      {scene.blocks.map(block => renderBlock(block, true))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // 无场景分组时，渲染平坦列表
  return (
    <div className={`flex flex-col gap-2 p-4 overflow-y-auto bg-gray-800 ${className || ''}`}>
      <h2 className="text-lg font-bold mb-2 text-gray-100">剧本段落</h2>
      
      {scriptBlocks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">📜</div>
          <div>请导入剧本文件</div>
          <div className="text-xs mt-2">支持 .txt, .json 格式</div>
        </div>
      ) : (
        scriptBlocks.map(block => renderBlock(block, false))
      )}
    </div>
  );
};
