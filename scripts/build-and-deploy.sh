#!/bin/bash
# EnjoySA 构建并部署到远端服务器
# 支持选择部署前端、后端或全栈

set -e

SERVER="singapore"
FRONTEND_DEPLOY="/opt/enjoysa"
BACKEND_DEPLOY="/opt/enjoysa-backend"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  EnjoySA 构建 & 部署${NC}"
echo -e "${BLUE}  服务器: ${SERVER} (43.134.28.147)${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# --- 选择部署范围 ---
echo "请选择部署范围:"
echo "  1) 全栈 (前端 + 后端)"
echo "  2) 仅前端"
echo "  3) 仅后端"
echo ""
read -p "选择 [1/2/3] (默认 1): " SCOPE
SCOPE=${SCOPE:-1}

DEPLOY_FRONTEND=false
DEPLOY_BACKEND=false

case $SCOPE in
  1) DEPLOY_FRONTEND=true; DEPLOY_BACKEND=true ;;
  2) DEPLOY_FRONTEND=true ;;
  3) DEPLOY_BACKEND=true ;;
  *) echo -e "${RED}无效选择${NC}"; exit 1 ;;
esac

STEP=0
TOTAL=0
[ "$DEPLOY_FRONTEND" = true ] && TOTAL=$((TOTAL + 2))
[ "$DEPLOY_BACKEND" = true ] && TOTAL=$((TOTAL + 2))
TOTAL=$((TOTAL + 1)) # 验证步骤

# --- 部署前端 ---
if [ "$DEPLOY_FRONTEND" = true ]; then
  STEP=$((STEP + 1))
  echo ""
  echo -e "${BLUE}[${STEP}/${TOTAL}] 构建前端...${NC}"
  cd "$PROJECT_DIR/web"
  npm run build

  STEP=$((STEP + 1))
  echo ""
  echo -e "${BLUE}[${STEP}/${TOTAL}] 上传前端到服务器...${NC}"
  scp -r dist/* ${SERVER}:${FRONTEND_DEPLOY}/
  echo -e "${GREEN}✓${NC} 前端上传完成"
fi

# --- 部署后端 ---
if [ "$DEPLOY_BACKEND" = true ]; then
  STEP=$((STEP + 1))
  echo ""
  echo -e "${BLUE}[${STEP}/${TOTAL}] 同步后端代码到服务器...${NC}"
  ssh ${SERVER} "mkdir -p ${BACKEND_DEPLOY}"

  rsync -avz --delete \
    --exclude '.git' \
    --exclude 'tmp' \
    --exclude 'uploads/*' \
    --exclude 'enjoysa-backend' \
    "$PROJECT_DIR/backend/" ${SERVER}:${BACKEND_DEPLOY}/backend/

  scp "$PROJECT_DIR/docker-compose.yml" ${SERVER}:${BACKEND_DEPLOY}/docker-compose.yml
  echo -e "${GREEN}✓${NC} 后端代码同步完成"

  STEP=$((STEP + 1))
  echo ""
  echo -e "${BLUE}[${STEP}/${TOTAL}] 构建并重启后端容器...${NC}"
  ssh ${SERVER} "cd ${BACKEND_DEPLOY} && docker compose up -d --build backend"
  echo -e "${GREEN}✓${NC} 后端容器已重启"
fi

# --- 验证 ---
STEP=$((STEP + 1))
echo ""
echo -e "${BLUE}[${STEP}/${TOTAL}] 验证部署...${NC}"
sleep 3

FRONTEND_STATUS="skip"
BACKEND_STATUS="skip"

if [ "$DEPLOY_FRONTEND" = true ]; then
  FRONTEND_STATUS=$(ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:6066/")
fi
if [ "$DEPLOY_BACKEND" = true ]; then
  BACKEND_STATUS=$(ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:6080/health")
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  部署结果${NC}"
echo -e "${GREEN}==========================================${NC}"

SUCCESS=true

if [ "$DEPLOY_FRONTEND" = true ]; then
  if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "  前端: ${GREEN}✓ HTTP 200${NC}  http://43.134.28.147:6066"
  else
    echo -e "  前端: ${RED}✗ HTTP ${FRONTEND_STATUS}${NC}"
    SUCCESS=false
  fi
fi

if [ "$DEPLOY_BACKEND" = true ]; then
  if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "  后端: ${GREEN}✓ HTTP 200${NC}  http://43.134.28.147:6080/health"
  else
    echo -e "  后端: ${RED}✗ HTTP ${BACKEND_STATUS}${NC}"
    SUCCESS=false
  fi
fi

echo ""
if [ "$SUCCESS" = true ]; then
  echo -e "  ${GREEN}部署成功!${NC}"
else
  echo -e "  ${RED}部分服务异常，请检查日志:${NC}"
  echo -e "  ssh ${SERVER} 'cd ${BACKEND_DEPLOY} && docker compose logs -f backend'"
fi
echo -e "${GREEN}==========================================${NC}"
