/**
 * 系统健康检查服务
 * 用于检测各个后端服务的运行状态
 */

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  port: number;
  url: string;
  message: string;
}

interface Dependencies {
  [key: string]: string;
}

export interface SystemStatus {
  overall: 'healthy' | 'partial' | 'down';
  services: ServiceStatus[];
  dependencies: Dependencies;
}

// 健康检查API端点
const HEALTH_API_BASE = 'http://localhost:8003';

/**
 * 获取系统健康状态
 */
export async function getSystemHealth(): Promise<SystemStatus> {
  try {
    const response = await fetch(`${HEALTH_API_BASE}/health/check`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取系统健康状态失败:', error);
    // 返回模拟数据以便调试
    return {
      overall: 'down',
      services: [
        { name: 'CLIP服务', status: 'stopped', port: 8000, url: 'http://localhost:8000', message: '服务未运行' },
        { name: 'VLM服务', status: 'stopped', port: 8001, url: 'http://localhost:8001', message: '服务未运行' },
        { name: '视频导出服务', status: 'stopped', port: 8002, url: 'http://localhost:8002', message: '服务未运行' },
        { name: 'Qdrant向量库', status: 'stopped', port: 6333, url: 'http://localhost:6333', message: '服务未运行' },
      ],
      dependencies: {
        'Node.js': '未检测到',
        'Python': '未检测到',
        'npm': '未检测到'
      }
    };
  }
}

/**
 * 一键修复服务
 */
export async function fixServices(): Promise<{status: string, message: string}> {
  try {
    const response = await fetch(`${HEALTH_API_BASE}/health/fix`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('修复服务失败:', error);
    return {
      status: 'error',
      message: '修复服务失败，请手动启动服务'
    };
  }
}

/**
 * 检查特定端口的服务是否可用
 */
export async function checkServiceStatus(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2秒超时
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}