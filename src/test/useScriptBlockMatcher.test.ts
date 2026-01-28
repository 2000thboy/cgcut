import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScriptBlockMatcher } from '../hooks/useScriptBlockMatcher';
import { assetMatchingService, type AssetMatchResult } from '../services/assetMatchingService';
import type { ScriptBlock, Shot } from '../types/DataModel';

// Mock the assetMatchingService
vi.mock('../services/assetMatchingService', () => ({
  assetMatchingService: {
    matchAssetForBlock: vi.fn(),
    resetUsedShots: vi.fn(),
  },
}));

describe('useScriptBlockMatcher', () => {
  const mockScriptBlocks: ScriptBlock[] = [
    {
      id: 'block1',
      scene_id: 'scene1',
      scene: 'INT. 办公室 - 夜晚',
      text: '[特写] 电脑屏幕显示神秘邮件 | 恐惧 | 3.0秒',
      emotion: '恐惧',
      expected_duration: 3.0,
    },
  ];

  const mockShots: Shot[] = [
    {
      id: 'shot1',
      label: '特写-手部',
      emotion: '恐惧',
      duration: 5.0,
      file_path: '/path/to/shot1.mp4',
      status: 'ready',
    },
  ];

  const mockMatches: AssetMatchResult[] = [
    {
      shotId: 'shot1',
      filePath: '/path/to/shot1.mp4',
      label: '特写-手部',
      similarity: 85,
      tags: ['恐惧', '特写'],
      description: '手部特写镜头',
      emotions: ['恐惧'],
      duration: 5.0,
      matchType: 'clip_vector',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty match candidates', () => {
    const { result } = renderHook(() =>
      useScriptBlockMatcher({
        scriptBlocks: mockScriptBlocks,
        assets: mockShots,
      })
    );

    expect(result.current.matchCandidates).toEqual({});
    expect(result.current.isBatchMatching).toBe(false);
    expect(result.current.batchProgress.current).toBe(0);
    expect(result.current.batchProgress.total).toBe(mockScriptBlocks.length);
  });

  it('should match a single block successfully', async () => {
    const mockMatchAssetForBlock = vi.mocked(assetMatchingService.matchAssetForBlock);
    mockMatchAssetForBlock.mockResolvedValue(mockMatches);

    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useScriptBlockMatcher({
        scriptBlocks: mockScriptBlocks,
        assets: mockShots,
        onMatch,
      })
    );

    await act(async () => {
      const matches = await result.current.matchSingleBlock('block1');
      expect(matches).toEqual(mockMatches);
      expect(onMatch).toHaveBeenCalledWith('block1', mockMatches[0]);
      expect(result.current.matchCandidates.block1).toEqual(mockMatches);
    });
  });

  it('should handle batch matching', async () => {
    const mockMatchAssetForBlock = vi.mocked(assetMatchingService.matchAssetForBlock);
    mockMatchAssetForBlock.mockResolvedValue(mockMatches);

    const onBatchComplete = vi.fn();
    const { result } = renderHook(() =>
      useScriptBlockMatcher({
        scriptBlocks: mockScriptBlocks,
        assets: mockShots,
        onBatchComplete,
      })
    );

    expect(result.current.isBatchMatching).toBe(false);

    await act(async () => {
      await result.current.matchAllBlocks();
    });

    expect(result.current.isBatchMatching).toBe(false);
    expect(result.current.batchProgress.current).toBe(mockScriptBlocks.length);
    expect(onBatchComplete).toHaveBeenCalledWith({
      block1: mockMatches,
    });
  });

  it('should clear matches', () => {
    const { result, rerender } = renderHook(() =>
      useScriptBlockMatcher({
        scriptBlocks: mockScriptBlocks,
        assets: mockShots,
      })
    );

    // First set some matches
    act(() => {
      result.current.matchCandidates.block1 = mockMatches;
    });

    // Then clear them
    act(() => {
      result.current.clearMatches();
    });

    expect(result.current.matchCandidates).toEqual({});
    expect(result.current.batchProgress.current).toBe(0);
    expect(result.current.isBatchMatching).toBe(false);
  });

  it('should handle block not found in matchSingleBlock', async () => {
    const { result } = renderHook(() =>
      useScriptBlockMatcher({
        scriptBlocks: mockScriptBlocks,
        assets: mockShots,
      })
    );

    const matches = await result.current.matchSingleBlock('nonexistent');
    expect(matches).toEqual([]);
  });
});
