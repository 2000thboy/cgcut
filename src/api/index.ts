/**
 * API Index
 * 
 * Centralized export for all API-related modules
 */

// API Client
export { ApiClient, ApiService, ApiError, ApiErrorType } from './ApiClient';
export type { ApiConfig, ApiRequest, ApiResponse } from './ApiClient';

// Service instances
export { apiClient, apiService } from './ApiClient';

// Service exports
export { llmService } from '../services/llmService';
export { clipService } from '../services/clipService';
export { assetMatchingService } from '../services/assetMatchingService';

// Type exports from services
export type { 
  ScriptBlock, 
  Shot, 
  Clip,
  LLMScriptAnalysisResponse,
  CLIPProcessResponse 
} from '../types/DataModel';

export type { AssetMatchResult } from '../services/assetMatchingService';