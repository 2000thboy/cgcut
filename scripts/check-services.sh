#!/bin/bash

echo "========================================"
echo "       CGCUT 服务状态检查"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查前端服务
echo -e "${BLUE}🌐 前端服务检查${NC}"
frontend_ports=(5173 5174 8005 8006 8007 8008)
frontend_found=false

for port in "${frontend_ports[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "  ${GREEN}✅ 前端服务运行在端口 $port${NC}"
        echo -e "  ${YELLOW}📍 访问地址: http://localhost:$port${NC}"
        frontend_found=true
        break
    fi
done

if [ "$frontend_found" = false ]; then
    echo -e "  ${RED}❌ 前端服务未找到${NC}"
fi

echo ""

# 检查CLIP服务
echo -e "${BLUE}📹 CLIP服务检查${NC}"
if netstat -tuln 2>/dev/null | grep -q ":8000 "; then
    echo -e "  ${GREEN}✅ CLIP服务运行在端口 8000${NC}"
    echo -e "  ${YELLOW}📍 API地址: http://localhost:8000${NC}"
else
    echo -e "  ${RED}❌ CLIP服务未找到${NC}"
fi

echo ""

# 检查VLM服务
echo -e "${BLUE}🎬 VLM服务检查${NC}"
if netstat -tuln 2>/dev/null | grep -q ":8001 "; then
    echo -e "  ${GREEN}✅ VLM服务运行在端口 8001${NC}"
    echo -e "  ${YELLOW}📍 API地址: http://localhost:8001${NC}"
else
    echo -e "  ${RED}❌ VLM服务未找到${NC}"
fi

echo ""

# 检查端口占用情况
echo -e "${BLUE}📊 端口占用情况${NC}"
echo "----------------------------------------"
for port in 8000 8001 8002 8003 8004 8005; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        if lsof -i :$port 2>/dev/null | grep -q "LISTEN"; then
            process=$(lsof -i :$port 2>/dev/null | grep "LISTEN" | awk '{print $1}')
            echo -e "  ${YELLOW}端口 $port:${NC} ${GREEN}[占用]${NC} ${BLUE}进程: $process${NC}"
        else
            echo -e "  ${YELLOW}端口 $port:${NC} ${GREEN}[占用]${NC}"
        fi
    else
        echo -e "  ${YELLOW}端口 $port:${NC} ${GREEN}[空闲]${NC}"
    fi
done

echo ""

# 检查Docker状态
echo -e "${BLUE}🐳 Docker状态检查${NC}"
if command -v docker &> /dev/null; then
    echo -e "  ${GREEN}✅ Docker已安装${NC}"
    if docker ps 2>/dev/null | grep -q "cgcut"; then
        echo -e "  ${GREEN}✅ Docker容器运行中${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep cgcut
    else
        echo -e "  ${YELLOW}ℹ️  Docker容器未运行${NC}"
    fi
else
    echo -e "  ${RED}❌ Docker未安装${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}       服务状态检查完成！${NC}"
echo "========================================"
echo ""

# 提供快速启动选项
echo -e "${YELLOW}💡 快速启动选项:${NC}"
echo "  1. 启动所有服务: ./scripts/start-all-services-improved.bat"
echo "  2. 端口管理工具: ./scripts/port-manager.bat"
echo "  3. Docker启动: docker-compose up"
echo "  4. 仅前端: npm run dev"
echo ""

# 显示当前访问地址
echo -e "${BLUE}🔗 当前可用服务地址:${NC}"
if netstat -tuln 2>/dev/null | grep -q ":8000 "; then
    echo -e "  ${YELLOW}  📹 CLIP API:${NC} ${GREEN}http://localhost:8000${NC}"
fi
if netstat -tuln 2>/dev/null | grep -q ":8001 "; then
    echo -e "  ${YELLOW}  🎬 VLM API:${NC} ${GREEN}http://localhost:8001${NC}"
fi

for port in 5173 5174 8005 8006 8007 8008; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "  ${YELLOW}  🌐 前端服务:${NC} ${GREEN}http://localhost:$port${NC}"
        break
    fi
done