/**
 * 全局类型定义
 */

// AssetMatchResult is imported from assetMatchingService

export interface BatchMatchProgress {
  current: number;
  total: number;
  currentBlockId?: string | undefined;
  currentBlockName?: string | undefined;
}

import type { ScriptBlock, Clip, Shot } from '../types/DataModel';
import type { AssetMatchResult } from '../services/assetMatchingService';

// Custom hooks types
export interface UseScriptBlockMatcherProps {
  scriptBlocks: ScriptBlock[];
  assets: Shot[];
  onMatch?: (blockId: string, match: AssetMatchResult) => void;
  onBatchComplete?: (results: Record<string, AssetMatchResult[]>) => void;
}

export interface UseScriptBlockMatcherReturn {
  matchCandidates: Record<string, AssetMatchResult[]>;
  isBatchMatching: boolean;
  batchProgress: BatchMatchProgress;
  matchSingleBlock: (blockId: string) => Promise<AssetMatchResult[]>;
  matchAllBlocks: () => Promise<void>;
  clearMatches: () => void;
}

export interface UseTimelinePlayerProps {
  clips: Clip[];
  onTimeUpdate?: (currentTime: number) => void;
  onClipSelect?: (clipId: string) => void;
}

export interface UseTimelinePlayerReturn {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  buffered: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  togglePlayPause: () => void;
  onTimeUpdate: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded: () => void;
}

export interface UseAssetManagerProps {
  onAssetSelect?: (asset: Shot) => void;
  onAssetUpload?: (files: FileList) => void;
  initialAssets?: Shot[];
}

export interface UseAssetManagerReturn {
  assets: Shot[];
  selectedAsset: Shot | null;
  isLoading: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectAsset: (asset: Shot) => void;
  deselectAsset: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadAssets: (files: FileList) => Promise<void>;
  removeAsset: (assetId: string) => void;
  clearSelection: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}