#!/bin/bash
# EnjoySA 全栈部署脚本
# 部署前端 + 后端(Docker) 到新加坡服务器

set -e

SERVER="singapore"
DEPLOY_PATH="/opt/enjoysa"
BACKEND_PATH="/opt/enjoysa-backend"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================="
echo "  EnjoySA 全栈部署"
echo "=========================================="

# Step 1: Build frontend
echo ""
echo "[1/6] 构建前端..."
cd "$PROJECT_DIR/web"
npm run build

# Step 2: Upload frontend
echo ""
echo "[2/6] 上传前端到服务器..."
scp -r dist/* ${SERVER}:${DEPLOY_PATH}/

# Step 3: Upload backend source + docker-compose
echo ""
echo "[3/6] 上传后端到服务器..."
ssh ${SERVER} "mkdir -p ${BACKEND_PATH}"

# Sync backend files (exclude unnecessary files)
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'tmp' \
  --exclude 'uploads/*' \
  "$PROJECT_DIR/backend/" ${SERVER}:${BACKEND_PATH}/backend/

scp "$PROJECT_DIR/docker-compose.yml" ${SERVER}:${BACKEND_PATH}/docker-compose.yml

# Step 4: Build and start containers
echo ""
echo "[4/6] 构建并启动后端容器..."
ssh ${SERVER} "cd ${BACKEND_PATH} && docker compose up -d --build"

# Step 5: Update nginx to proxy API
echo ""
echo "[5/6] 配置 nginx API 代理..."
ssh ${SERVER} "cat > /tmp/enjoysa-api-nginx.conf << 'NGINX'
    # API proxy to Go backend
    location /api/ {
        proxy_pass http://127.0.0.1:6080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # Upload files proxy
    location /uploads/ {
        proxy_pass http://127.0.0.1:6080;
    }
NGINX
"

# Check if nginx already has the API proxy
HAS_API=$(ssh ${SERVER} "grep -c 'proxy_pass.*6080' /etc/nginx/sites-enabled/enjoysa* 2>/dev/null || echo 0")
if [ "$HAS_API" = "0" ]; then
  echo "  需要手动将 API 代理配置添加到 nginx 配置中"
  echo "  配置文件已保存到服务器: /tmp/enjoysa-api-nginx.conf"
  echo "  请将其中的 location 块添加到 enjoysa 的 server {} 中"
else
  echo "  nginx API 代理已配置 ✓"
fi

# Step 6: Verify
echo ""
echo "[6/6] 验证部署..."
sleep 3

FRONTEND_STATUS=$(ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:6066/")
BACKEND_STATUS=$(ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:6080/health")

echo ""
echo "=========================================="
echo "  部署结果"
echo "=========================================="
echo "  前端: HTTP ${FRONTEND_STATUS} - http://43.134.28.147:6066"
echo "  后端: HTTP ${BACKEND_STATUS} - http://43.134.28.147:6080/health"

if [ "$FRONTEND_STATUS" = "200" ] && [ "$BACKEND_STATUS" = "200" ]; then
  echo ""
  echo "  全栈部署成功! ✓"
else
  echo ""
  echo "  警告: 部分服务未就绪，请检查日志"
  echo "  查看日志: ssh ${SERVER} 'cd ${BACKEND_PATH} && docker compose logs -f'"
fi
echo "=========================================="
