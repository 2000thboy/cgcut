/**
 * Hooks Index
 * 
 * Centralized export for all custom hooks
 */

// Hook exports
export { useScriptBlockMatcher } from './useScriptBlockMatcher';
export { useTimelinePlayer } from './useTimelinePlayer';
export { useAssetManager } from './useAssetManager';

// Type exports
export type {
  UseScriptBlockMatcherProps,
  UseScriptBlockMatcherReturn,
  UseTimelinePlayerProps,
  UseTimelinePlayerReturn,
  UseAssetManagerProps,
  UseAssetManagerReturn,
  BatchMatchProgress,
} from './types';

// Re-export AssetMatchResult from service for convenience
export type { AssetMatchResult } from '../services/assetMatchingService';