#!/bin/bash

echo "===================================="
echo "    CGCUT Docker 服务启动脚本"
echo "===================================="
echo ""

# 检查Docker是否可用
if command -v docker &> /dev/null; then
    echo "✅ Docker 已安装，支持一键启动"
    DOCKER_AVAILABLE=1
else
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查端口占用情况
echo ""
echo "📡 检查服务端口占用情况..."

# 检查前端端口 (5173)
if netstat -tuln 2>/dev/null | grep -q ":5173 "; then
    echo "⚠️  端口 5173 已被占用，将使用备用端口"
    FRONTEND_PORT=5174
else
    echo "✅ 端口 5173 可用"
    FRONTEND_PORT=5173
fi

# 检查CLIP服务端口 (8000)
if netstat -tuln 2>/dev/null | grep -q ":8000 "; then
    echo "⚠️ 端口 8000 已被占用，将跳过CLIP服务启动"
    SKIP_CLIP=1
else
    echo "✅ 端口 8000 可用"
    SKIP_CLIP=0
fi

# 检查VLM服务端口 (8001)
if netstat -tuln 2>/dev/null | grep -q ":8001 "; then
    echo "⚠️ 端口 8001 已被占用，将跳过VLM服务启动"
    SKIP_VLM=1
else
    echo "✅ 端口 8001 可用"
    SKIP_VLM=0
fi

echo ""
echo "🚀 启动服务..."

# 启动CLIP服务 (如果端口可用)
if [ $SKIP_CLIP -eq 0 ]; then
    echo "📹 启动 CLIP 服务..."
    cd clip-service
    python clip_server.py &
    CLIP_PID=$!
    echo "✅ CLIP 服务已启动 (PID: $CLIP_PID)"
else
    echo "ℹ️  跳过 CLIP 服务启动"
fi

# 等待CLIP服务启动
sleep 2

# 启动VLM服务 (如果端口可用)
if [ $SKIP_VLM -eq 0 ]; then
    echo "🎬 启动 VLM 服务..."
    cd vlm-service
    python vlm_server.py &
    VLM_PID=$!
    echo "✅ VLM 服务已启动 (PID: $VLM_PID)"
else
    echo "ℹ️  跳过 VLM 服务启动"
fi

# 等待VLM服务启动
sleep 2

# 启动前端服务
echo "🌐 启动前端服务..."
docker-compose up --build frontend &
FRONTEND_PID=$!

echo ""
echo "===================================="
echo "        服务启动完成！"
echo "===================================="
echo ""
echo "📍 服务地址:"
if [ $SKIP_CLIP -eq 0 ]; then
    echo "   📹 CLIP服务: http://localhost:8000"
fi
if [ $SKIP_VLM -eq 0 ]; then
    echo "   🎬 VLM服务: http://localhost:8001"
fi
echo "   🌐 前端服务: http://localhost:$FRONTEND_PORT"
echo ""
echo "💡 使用 Ctrl+C 停止所有服务"
echo ""
echo "🐳 如需重新构建: docker-compose up --build"
echo ""

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; docker-compose down; kill $CLIP_PID 2>/dev/null; kill $VLM_PID 2>/dev/null; echo "✅ 所有服务已停止"; exit 0' INT

# 保持脚本运行
wait