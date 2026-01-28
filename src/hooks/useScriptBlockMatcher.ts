import { useState, useCallback, useEffect } from 'react';
import type { ScriptBlock } from '../types/DataModel';
import { assetMatchingService, type AssetMatchResult } from '../services/assetMatchingService';
import type { UseScriptBlockMatcherProps, BatchMatchProgress } from './types';

interface UseScriptBlockMatcherReturn {
  matchCandidates: Record<string, AssetMatchResult[]>;
  isBatchMatching: boolean;
  batchProgress: {
    current: number;
    total: number;
    currentBlockId?: string;
    currentBlockName?: string;
  };
  matchSingleBlock: (blockId: string) => Promise<AssetMatchResult[]>;
  matchAllBlocks: () => Promise<void>;
  clearMatches: () => void;
}

export function useScriptBlockMatcher({
  scriptBlocks,
  assets,
  onMatch,
  onBatchComplete,
}: UseScriptBlockMatcherProps): UseScriptBlockMatcherReturn {
  const [matchCandidates, setMatchCandidates] = useState<Record<string, AssetMatchResult[]>>({});
  const [isBatchMatching, setIsBatchMatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchMatchProgress>({
    current: 0,
    total: scriptBlocks.length,
    currentBlockId: undefined,
    currentBlockName: undefined,
  });

  // 匹配单个剧本段落
  const matchSingleBlock = useCallback(async (blockId: string): Promise<AssetMatchResult[]> => {
    const block = scriptBlocks.find(b => b.id === blockId);
    if (!block) {
      console.warn(`Block ${blockId} not found`);
      return [];
    }

    try {
      const matches = await assetMatchingService.matchAssetForBlock(block, 5, assets);
      
      // 更新匹配候选
      setMatchCandidates(prev => ({
        ...prev,
        [blockId]: matches
      }));

      // 通知单个匹配完成
      if (matches.length > 0) {
        onMatch?.(blockId, matches[0]);
      }

      return matches;
    } catch (error) {
      console.error(`Failed to match block ${blockId}:`, error);
      return [];
    }
  }, [scriptBlocks, assets, onMatch]);

  // 匹配所有剧本段落
  const matchAllBlocks = useCallback(async (): Promise<void> => {
    if (scriptBlocks.length === 0) {
      console.warn('No script blocks to match');
      return;
    }

    setIsBatchMatching(true);
    setBatchProgress(prev => ({ ...prev, current: 0, total: scriptBlocks.length }));
    
    const allResults: Record<string, AssetMatchResult[]> = {};

    try {
      for (let i = 0; i < scriptBlocks.length; i++) {
        const block = scriptBlocks[i];
        const matches = await matchSingleBlock(block.id);
        
        allResults[block.id] = matches;
        
        // 更新进度
        setBatchProgress({
          current: i + 1,
          total: scriptBlocks.length,
          currentBlockId: block.id,
          currentBlockName: (block.text || '').substring(0, 50) + ((block.text || '').length > 50 ? '...' : ''),
        });

        // 添加延迟以避免过于频繁的API调用
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 完成批量匹配
      setMatchCandidates(allResults);
      onBatchComplete?.(allResults);
      
    } catch (error) {
      console.error('Batch matching failed:', error);
    } finally {
      setIsBatchMatching(false);
      setBatchProgress(prev => ({ ...prev, current: prev.total }));
    }
  }, [scriptBlocks, matchSingleBlock, onBatchComplete]);

  // 清除所有匹配结果
  const clearMatches = useCallback(() => {
    setMatchCandidates({});
    setIsBatchMatching(false);
    setBatchProgress({
      current: 0,
      total: scriptBlocks.length,
      currentBlockId: undefined,
      currentBlockName: undefined,
    });
  }, [scriptBlocks.length]);

  // 当脚本块变化时，清除相关匹配结果
  useEffect(() => {
    if (scriptBlocks.length > 0) {
      const blockIds = new Set(scriptBlocks.map(b => b.id));
      const filteredMatches = Object.fromEntries(
        Object.entries(matchCandidates).filter(([blockId]) => blockIds.has(blockId))
      );
      setMatchCandidates(filteredMatches);
    }
  }, [scriptBlocks]);

  return {
    matchCandidates,
    isBatchMatching,
    batchProgress,
    matchSingleBlock,
    matchAllBlocks,
    clearMatches,
  };
}