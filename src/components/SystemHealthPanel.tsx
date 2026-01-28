import React, { useEffect, useState } from 'react';
import { getSystemHealth, fixServices, SystemStatus } from '../services/healthService';

interface SystemHealthPanelProps {
  className?: string;
}

export function SystemHealthPanel({ className = '' }: SystemHealthPanelProps) {
  const [healthStatus, setHealthStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // 检查系统健康状态
  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const status = await getSystemHealth();
      setHealthStatus(status);
    } catch (error) {
      console.error('检查系统健康失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 一键修复
  const handleFix = async () => {
    setIsFixing(true);
    try {
      const result = await fixServices();
      if (result.status === 'success') {
        alert('✅ ' + result.message);
        // 10秒后重新检查状态
        setTimeout(() => {
          checkHealth();
        }, 10000);
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      alert('❌ 修复失败: ' + (error as Error).message);
    } finally {
      setIsFixing(false);
    }
  };

  // 组件挂载时检查健康状态
  useEffect(() => {
    checkHealth();
    // 每30秒自动检查一次
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-3 h-3 rounded-full bg-gray-500 animate-pulse"></div>
        <span className="text-sm text-gray-400">检测中...</span>
      </div>
    );
  }

  if (!healthStatus) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <span className="text-sm text-red-400">检测失败</span>
        <button
          onClick={checkHealth}
          className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
        >
          重试
        </button>
      </div>
    );
  }

  // 状态颜色映射
  const statusColor = {
    healthy: 'bg-green-500',
    partial: 'bg-yellow-500',
    down: 'bg-red-500',
  };

  const statusText = {
    healthy: '系统正常',
    partial: '部分服务异常',
    down: '系统异常',
  };

  const runningServices = healthStatus.services.filter(s => s.status === 'running').length;
  const totalServices = healthStatus.services.length;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-3">
        {/* 状态指示器 */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
          <div className={`w-3 h-3 rounded-full ${statusColor[healthStatus.overall]} ${healthStatus.overall === 'healthy' ? 'animate-pulse' : ''}`}></div>
          <span className="text-sm text-gray-300">
            {statusText[healthStatus.overall]} ({runningServices}/{totalServices})
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={checkHealth}
            disabled={isLoading}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors disabled:opacity-50"
            title="刷新状态"
          >
            🔄 刷新
          </button>
          
          {healthStatus.overall !== 'healthy' && (
            <button
              onClick={handleFix}
              disabled={isFixing}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 font-semibold"
              title="一键启动所有服务"
            >
              {isFixing ? '⏳ 启动中...' : '🚀 一键修复'}
            </button>
          )}
        </div>
      </div>

      {/* 详细信息面板 */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-100">服务状态详情</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* 服务列表 */}
          <div className="space-y-2 mb-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase">微服务</h4>
            {healthStatus.services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.status === 'running'
                        ? 'bg-green-500'
                        : service.status === 'stopped'
                        ? 'bg-gray-500'
                        : 'bg-red-500'
                    }`}
                  ></div>
                  <span className="text-sm text-gray-200">{service.name}</span>
                </div>
                <span className="text-xs text-gray-400">:{service.port}</span>
              </div>
            ))}
          </div>

          {/* 依赖检查 */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase">系统依赖</h4>
            {Object.entries(healthStatus.dependencies).map(([name, status]) => (
              <div key={name} className="flex justify-between p-2 bg-gray-700 rounded">
                <span className="text-sm text-gray-200">{name}</span>
                <span className={`text-xs ${status.includes('已安装') ? 'text-green-400' : 'text-red-400'}`}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
