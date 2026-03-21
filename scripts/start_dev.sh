#!/bin/bash
# EnjoySA 本地开发环境启动脚本
# 交互式启动前端 + 后端

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  EnjoySA 本地开发环境${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# --- 检查依赖 ---
check_dep() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}✗ $1 未安装${NC}"
    return 1
  fi
  echo -e "${GREEN}✓${NC} $1"
  return 0
}

echo "检查依赖..."
MISSING=0
check_dep "node" || MISSING=1
check_dep "go" || MISSING=1
check_dep "psql" || MISSING=1

if [ $MISSING -eq 1 ]; then
  echo -e "\n${RED}请先安装缺失的依赖${NC}"
  exit 1
fi

# --- 检查数据库 ---
echo ""
echo "检查 PostgreSQL..."
if pg_isready -q 2>/dev/null; then
  echo -e "${GREEN}✓${NC} PostgreSQL 运行中"
else
  echo -e "${YELLOW}! PostgreSQL 未运行，尝试启动...${NC}"
  if command -v brew &>/dev/null; then
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null
    sleep 2
  fi
  if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}✓${NC} PostgreSQL 已启动"
  else
    echo -e "${RED}✗ PostgreSQL 启动失败，请手动启动${NC}"
    exit 1
  fi
fi

# 检查数据库是否存在
if ! psql -lqt 2>/dev/null | grep -qw enjoysa; then
  echo -e "${YELLOW}! 数据库 enjoysa 不存在，创建中...${NC}"
  createdb enjoysa 2>/dev/null
  echo -e "${GREEN}✓${NC} 数据库 enjoysa 已创建"
else
  echo -e "${GREEN}✓${NC} 数据库 enjoysa 存在"
fi

# --- 选择启动模式 ---
echo ""
echo "请选择启动模式:"
echo "  1) 前端 + 后端 (全栈)"
echo "  2) 仅前端"
echo "  3) 仅后端"
echo ""
read -p "选择 [1/2/3] (默认 1): " MODE
MODE=${MODE:-1}

cleanup() {
  echo ""
  echo -e "${YELLOW}正在停止服务...${NC}"
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo -e "${GREEN}已停止${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

BACKEND_PID=""
FRONTEND_PID=""

# --- 启动后端 ---
start_backend() {
  echo ""
  echo -e "${BLUE}[后端] 启动 Go 服务 (端口 6080)...${NC}"
  cd "$PROJECT_DIR/backend"

  # 清理占用 6080 端口的旧进程
  OLD_PID=$(lsof -ti tcp:6080 2>/dev/null)
  if [ -n "$OLD_PID" ]; then
    echo -e "${YELLOW}! 端口 6080 被占用 (PID: $OLD_PID)，正在关闭...${NC}"
    kill $OLD_PID 2>/dev/null
    sleep 1
    kill -9 $OLD_PID 2>/dev/null
  fi

  # 安装依赖
  go mod download 2>/dev/null

  # 启动
  go run ./cmd/server/ -config configs/config.yaml &
  BACKEND_PID=$!
  sleep 2

  if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 后端已启动: http://localhost:6080"
  else
    echo -e "${RED}✗ 后端启动失败${NC}"
  fi
}

# --- 启动前端 ---
start_frontend() {
  echo ""
  echo -e "${BLUE}[前端] 启动 Vite 开发服务器 (端口 5173)...${NC}"
  cd "$PROJECT_DIR/web"

  # 清理占用 5173-5179 端口的旧 Vite 进程
  for PORT in 5173 5174 5175 5176 5177 5178 5179; do
    OLD_PID=$(lsof -ti tcp:$PORT 2>/dev/null)
    if [ -n "$OLD_PID" ]; then
      echo -e "${YELLOW}! 端口 $PORT 被占用 (PID: $OLD_PID)，正在关闭...${NC}"
      kill $OLD_PID 2>/dev/null
    fi
  done
  sleep 1

  # 安装依赖
  if [ ! -d "node_modules" ]; then
    echo "安装 npm 依赖..."
    npm install
  fi

  # 启动
  npm run dev &
  FRONTEND_PID=$!
  sleep 3

  if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 前端已启动: http://localhost:5173"
  else
    echo -e "${RED}✗ 前端启动失败${NC}"
  fi
}

case $MODE in
  1)
    start_backend
    start_frontend
    ;;
  2)
    start_frontend
    ;;
  3)
    start_backend
    ;;
  *)
    echo -e "${RED}无效选择${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  开发环境已就绪${NC}"
echo -e "${GREEN}==========================================${NC}"
[ -n "$FRONTEND_PID" ] && echo -e "  前端: ${BLUE}http://localhost:5173${NC}"
[ -n "$BACKEND_PID" ]  && echo -e "  后端: ${BLUE}http://localhost:6080${NC}"
echo -e "  按 ${YELLOW}Ctrl+C${NC} 停止所有服务"
echo -e "${GREEN}==========================================${NC}"
echo ""

# 等待进程
wait
