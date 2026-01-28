import React, { useState, ReactNode } from 'react';

interface EditorLayoutProps {
  // 各区域内容
  header: ReactNode;
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  bottomPanel?: ReactNode;
  // 进度条(可选)
  progressBar?: ReactNode;
  // 模态框(可选)
  modals?: ReactNode;
}

/**
 * 编辑器主布局组件
 * 参考OpenCut的三栏+底部时间轴布局
 * 
 * 布局结构:
 * +------------------------------------------+
 * |              Header                      |
 * +------------------------------------------+
 * |         | Progress Bar (optional)        |
 * +------------------------------------------+
 * |  Left   |    Center     |     Right     |
 * |  Panel  |    Panel      |     Panel     |
 * |         |               |               |
 * +------------------------------------------+
 * |              Bottom Panel                |
 * +------------------------------------------+
 */
export const EditorLayout: React.FC<EditorLayoutProps> = ({
  header,
  leftPanel,
  centerPanel,
  rightPanel,
  bottomPanel,
  progressBar,
  modals,
}) => {
  // 面板宽度状态
  const [leftWidth] = useState(320);
  const [rightWidth] = useState(320);
  
  // 面板折叠状态
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      {/* 顶部工具栏 */}
      {header}

      {/* 可选的进度条 */}
      {progressBar}

      {/* 主内容区: 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧面板 */}
        <aside
          className={`bg-gray-800 border-r border-gray-700 flex-shrink-0 overflow-hidden transition-all duration-200 flex flex-col`}
          style={{ width: leftCollapsed ? 40 : leftWidth }}
        >
          {/* 折叠控制 */}
          <div className="h-8 bg-gray-850 border-b border-gray-700 flex items-center justify-between px-2 flex-shrink-0">
            {!leftCollapsed && (
              <span className="text-xs font-medium text-gray-400">剧本分镜</span>
            )}
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="text-gray-400 hover:text-gray-200 text-sm ml-auto"
              title={leftCollapsed ? '展开面板' : '折叠面板'}
            >
              {leftCollapsed ? '▶' : '◀'}
            </button>
          </div>
          
          {/* 面板内容 */}
          {!leftCollapsed && (
            <div className="flex-1 overflow-hidden">
              {leftPanel}
            </div>
          )}
        </aside>

        {/* 中间区域 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {centerPanel}
        </main>

        {/* 右侧面板 */}
        <aside
          className={`bg-gray-800 border-l border-gray-700 flex-shrink-0 overflow-hidden transition-all duration-200 flex flex-col`}
          style={{ width: rightCollapsed ? 40 : rightWidth }}
        >
          {/* 折叠控制 */}
          <div className="h-8 bg-gray-850 border-b border-gray-700 flex items-center justify-between px-2 flex-shrink-0">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="text-gray-400 hover:text-gray-200 text-sm"
              title={rightCollapsed ? '展开面板' : '折叠面板'}
            >
              {rightCollapsed ? '◀' : '▶'}
            </button>
            {!rightCollapsed && (
              <span className="text-xs font-medium text-gray-400">素材库</span>
            )}
          </div>
          
          {/* 面板内容 */}
          {!rightCollapsed && (
            <div className="flex-1 overflow-hidden">
              {rightPanel}
            </div>
          )}
        </aside>
      </div>

      {/* 底部面板(可选) */}
      {bottomPanel}

      {/* 模态框层 */}
      {modals}
    </div>
  );
};

export default EditorLayout;
