import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError, ApiErrorType } from '../api/ApiClient';

// Mock fetch
global.fetch = vi.fn();

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      timeout: 1000,
      maxRetries: 2,
    });
  });

  it('should create instance with default config', () => {
    const client = new ApiClient();
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should handle successful GET request', async () => {
    const mockResponse = { data: 'test', status: 200 };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve(mockResponse),
    });

    const result = await apiClient.get('/test');
    expect(result.data).toEqual(mockResponse);
    expect(result.status).toBe(200);
  });

  it('should handle POST request with data', async () => {
    const mockData = { name: 'test' };
    const mockResponse = { id: 1, ...mockData };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new Headers(),
      json: () => Promise.resolve(mockResponse),
    });

    const result = await apiClient.post('/test', mockData);
    expect(result.data).toEqual(mockResponse);
    expect(result.status).toBe(201);
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(apiClient.get('/test')).rejects.toThrow('网络连接失败');
  });

  it('should handle timeout errors', async () => {
    // Create a timeout error
    const timeoutError = new DOMException('Request timeout', 'AbortError');
    (global.fetch as any).mockRejectedValueOnce(timeoutError);

    await expect(apiClient.get('/test')).rejects.toThrow('请求超时');
  });

  it('should retry on network errors', async () => {
    // First call fails, second succeeds
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve({ data: 'success' }),
      });

    const result = await apiClient.get('/test');
    expect(result.data).toEqual({ data: 'success' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle authentication', async () => {
    apiClient.setAuthToken('test-token');
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({ data: 'authenticated' }),
    });

    await apiClient.get('/protected');
    
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/protected',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('should clear authentication token', () => {
    apiClient.setAuthToken('test-token');
    expect(apiClient.getAuthToken()).toBe('test-token');
    
    apiClient.clearAuthToken();
    expect(apiClient.getAuthToken()).toBe(null);
  });
});

describe('ApiError', () => {
  it('should create ApiError with message and code', () => {
    const error = new ApiError('Test error', 'TEST_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('ApiError');
  });

  it('should handle error with status', () => {
    const originalError = { status: 404 };
    const error = new ApiError('Not found', 'NOT_FOUND', originalError);
    expect(error.status).toBe(404);
  });
});

describe('ApiErrorType', () => {
  it('should have correct error types', () => {
    expect(ApiErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ApiErrorType.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    expect(ApiErrorType.AUTH_ERROR).toBe('AUTH_ERROR');
    expect(ApiErrorType.SERVER_ERROR).toBe('SERVER_ERROR');
    expect(ApiErrorType.CLIENT_ERROR).toBe('CLIENT_ERROR');
    expect(ApiErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });
});