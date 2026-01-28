/**
 * 统一 API 客户端
 * 
 * 提供统一的 HTTP 请求接口，包含：
 * - 自动重试机制
 * - 统一错误处理
 * - 请求/响应拦截
 * - 超时管理
 * - 认证处理
 */

import type { ScriptBlock, Shot, Clip, LLMScriptAnalysisResponse, CLIPProcessResponse } from '../types/DataModel';

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: 'json' | 'blob' | 'text';
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class ApiError extends Error {
  message: string;
  status?: number;
  code?: string;
  originalError?: any;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;

  constructor(message: string, code?: string, originalError?: any) {
    super(message);
    this.name = 'ApiError';
    this.message = message;
    this.code = code;
    this.originalError = originalError;
    
    if (originalError) {
      if (originalError.status) {
        this.status = originalError.status;
      }
      if (originalError.isNetworkError) {
        this.isNetworkError = true;
      }
      if (originalError.isTimeoutError) {
        this.isTimeoutError = true;
      }
    }
  }
}

// 默认配置
const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: '',
  timeout: 30000, // 30秒
  maxRetries: 3,
  retryDelay: 1000, // 1秒
};

// 错误类型
export const ApiErrorType = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export class ApiClient {
  private config: ApiConfig;
  private authToken: string | null = null;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // 设置认证令牌
  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  // 获取认证令牌
  getAuthToken(): string | null {
    return this.authToken;
  }

  // 移除认证令牌
  clearAuthToken() {
    this.authToken = null;
  }

  // 统一请求方法
  async request<T = any>(options: ApiRequest): Promise<ApiResponse<T>> {
    const { method, url, data, headers = {}, timeout = this.config.timeout } = options;

    // 构建完整URL
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // 添加认证头
    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
    };

    // 添加请求体
    if (data && (method === 'POST' || method === 'PUT')) {
      requestConfig.body = JSON.stringify(data);
    }

    // 重试机制
    let lastError: any;
    const maxRetries = options.timeout ? 1 : this.config.maxRetries || 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(fullUrl, {
          ...requestConfig,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 处理响应
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // 尝试解析JSON响应
        let responseData: any;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
          }
        } catch (parseError) {
          responseData = null;
        }

        return {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        };

      } catch (error) {
        lastError = error;

        // 如果是网络错误且还有重试次数，则等待后重试
        if (attempt < maxRetries - 1 && this.isNetworkError(error)) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          continue;
        }

        // 如果是超时错误，抛出超时异常
        if (this.isTimeoutError(error)) {
          throw new ApiError(
            `请求超时 (${timeout}ms)`,
            ApiErrorType.TIMEOUT_ERROR,
            error
          );
        }

        // 如果是网络错误，抛出网络异常
        if (this.isNetworkError(error)) {
          throw new ApiError(
            '网络连接失败',
            ApiErrorType.NETWORK_ERROR,
            error
          );
        }

        // 其他错误继续抛出
        throw error;
      }
    }

    // 如果所有重试都失败，抛出最后的错误
    throw new ApiError(
      '请求失败，请稍后重试',
      ApiErrorType.UNKNOWN_ERROR,
      lastError
    );
  }

  // GET请求
  async get<T = any>(url: string, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  // POST请求
  async post<T = any>(url: string, data?: any, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  // PUT请求
  async put<T = any>(url: string, data?: any, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  // DELETE请求
  async delete<T = any>(url: string, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  // 检查是否为网络错误
  private isNetworkError(error: any): boolean {
    return (
      error instanceof TypeError &&
      (error.message.includes('NetworkError') || 
       error.message.includes('fetch failed') ||
       error.message.includes('Failed to fetch'))
    );
  }

  // 检查是否为超时错误
  private isTimeoutError(error: any): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  // 创建API错误对象
  private createApiError(type: string, message: string, originalError?: any): ApiError {
    return new ApiError(message, type, originalError);
  }

  // 处理API错误
  static handleApiError(error: any): never {
    if (error instanceof ApiError) {
      throw error;
    }

    // 处理HTTP错误
    if (error.status || error.response?.status) {
      const status = error.status || error.response?.status;
      
      if (status === 401) {
        throw new ApiError('认证失败，请重新登录', 'AUTH_ERROR', error);
      } else if (status === 403) {
        throw new ApiError('权限不足', 'AUTH_ERROR', error);
      } else if (status >= 500) {
        throw new ApiError('服务器错误，请稍后重试', 'SERVER_ERROR', error);
      } else if (status >= 400) {
        throw new ApiError(`请求错误 (${status})`, 'CLIENT_ERROR', error);
      }
    }

    // 处理网络错误
    if (error.message?.includes('NetworkError')) {
      throw new ApiError('网络连接失败', 'NETWORK_ERROR', error);
    }

    // 处理其他错误
    throw new ApiError(error.message || '未知错误', 'UNKNOWN_ERROR', error);
  }
}

// 创建默认API客户端实例
export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  maxRetries: 3,
});

// API服务类
export class ApiService {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  // LLM服务
  async analyzeScript(scriptContent: string, fileName: string): Promise<LLMScriptAnalysisResponse> {
    try {
      const response = await this.client.post('/api/llm/analyze', {
        scriptContent,
        fileName,
        options: {
          language: 'zh',
          includeEmotions: true,
          estimateDuration: true,
        },
      });

      return response.data;
    } catch (error) {
      ApiClient.handleApiError(error);
    }
  }

  // CLIP服务
  async scanDirectory(directoryPath: string): Promise<CLIPProcessResponse> {
    try {
      const response = await this.client.post('/api/clip/scan', {
        directoryPath,
        filePatterns: ['*.mp4', '*.mov', '*.avi'],
        skipProcessed: false,
        extractKeyframes: true,
      });

      return response.data;
    } catch (error) {
      ApiClient.handleApiError(error);
    }
  }

  async searchClips(query: string, topK: number = 5, threshold?: number): Promise<any> {
    try {
      const response = await this.client.post('/api/clip/search', {
        query,
        mode: 'semantic',
        limit: topK,
        threshold,
      });

      return response.data;
    } catch (error) {
      ApiClient.handleApiError(error);
    }
  }

  // VLM服务
  async describeVideo(videoPath: string): Promise<any> {
    try {
      const response = await this.client.post('/api/vlm/describe', {
        videoPath,
      });

      return response.data;
    } catch (error) {
      ApiClient.handleApiError(error);
    }
  }

  // 项目管理
  async getProjectStatus(): Promise<any> {
    try {
      const response = await this.client.get('/api/project/status');
      return response.data;
    } catch (error) {
      ApiClient.handleApiError(error);
    }
  }

  async exportProject(format: 'json' | 'pdf' | 'xml'): Promise<Blob> {
    try {
      const response = await this.client.get(`/api/project/export/${format}`, {
        responseType: 'blob' as any,
      });
      return response.data;
    } catch (error) {
      ApiClient.handleApiError(error);
    }
  }
}

// 创建API服务实例
export const apiService = new ApiService(apiClient);