"""
系统健康检查API服务
用于检测各个微服务和依赖的运行状态
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import subprocess
import sys
from typing import Dict, List
from pydantic import BaseModel

app = FastAPI(title="Health Check Service")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ServiceStatus(BaseModel):
    name: str
    status: str  # "running", "stopped", "error"
    port: int
    url: str
    message: str = ""

class SystemStatus(BaseModel):
    overall: str  # "healthy", "partial", "down"
    services: List[ServiceStatus]
    dependencies: Dict[str, str]  # {"node": "ok", "python": "ok", ...}

async def check_service(name: str, url: str, port: int, timeout: float = 2.0) -> ServiceStatus:
    """检查单个服务是否运行"""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            if response.status_code == 200:
                return ServiceStatus(
                    name=name,
                    status="running",
                    port=port,
                    url=url,
                    message="服务正常运行"
                )
            else:
                return ServiceStatus(
                    name=name,
                    status="error",
                    port=port,
                    url=url,
                    message=f"服务响应异常: {response.status_code}"
                )
    except Exception as e:
        return ServiceStatus(
            name=name,
            status="stopped",
            port=port,
            url=url,
            message=f"服务未运行或无法连接"
        )

def check_dependency(command: str, check_args: List[str]) -> str:
    """检查系统依赖（Node.js, Python等）"""
    try:
        result = subprocess.run(
            [command] + check_args,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.strip().split('\n')[0] if result.stdout else ""
            return f"已安装 ({version})"
        else:
            return "未安装或版本过低"
    except FileNotFoundError:
        return "未找到"
    except Exception as e:
        return f"检查失败: {str(e)}"

@app.get("/health/check", response_model=SystemStatus)
async def check_all_services():
    """检查所有服务和依赖的健康状态"""
    
    # 定义需要检查的服务
    services_to_check = [
        ("CLIP服务", "http://localhost:8000/health", 8000),
        ("VLM服务", "http://localhost:8001/health", 8001),
        ("视频导出服务", "http://localhost:8002/health", 8002),
        ("Qdrant向量库", "http://localhost:6333/", 6333),
    ]
    
    # 并发检查所有服务
    service_results = await asyncio.gather(*[
        check_service(name, url, port) for name, url, port in services_to_check
    ])
    
    # 检查系统依赖
    dependencies = {
        "Node.js": check_dependency("node", ["--version"]),
        "Python": check_dependency("python", ["--version"]),
        "npm": check_dependency("npm", ["--version"]),
    }
    
    # 判断整体状态
    running_count = sum(1 for s in service_results if s.status == "running")
    total_count = len(service_results)
    
    if running_count == total_count:
        overall = "healthy"
    elif running_count > 0:
        overall = "partial"
    else:
        overall = "down"
    
    return SystemStatus(
        overall=overall,
        services=service_results,
        dependencies=dependencies
    )

@app.post("/health/fix")
async def fix_services():
    """一键修复：启动所有服务"""
    try:
        # 检查批处理文件是否存在
        import os
        script_path = os.path.join(os.path.dirname(__file__), "start-all-services.bat")
        
        if not os.path.exists(script_path):
            return {
                "status": "error",
                "message": "找不到启动脚本 start-all-services.bat"
            }
        
        # 在新窗口中启动批处理脚本
        if sys.platform == "win32":
            subprocess.Popen(
                ["cmd", "/c", "start", "cmd", "/k", script_path],
                shell=True,
                cwd=os.path.dirname(__file__)
            )
            return {
                "status": "success",
                "message": "正在启动所有服务，请稍候..."
            }
        else:
            return {
                "status": "error",
                "message": "当前仅支持Windows系统一键启动"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"启动失败: {str(e)}"
        }

@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "ok", "service": "health-check"}

if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("Health Check Service Starting...")
    print("=" * 50)
    print("Listening on port: 8003")
    print("API docs: http://localhost:8003/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8003)
