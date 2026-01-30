#!/bin/bash
# EnjoySA 部署脚本
# 部署到新加坡服务器 43.134.28.147:6066

set -e

# 配置
SERVER="singapore"
DEPLOY_PATH="/opt/enjoysa"
WEB_DIR="$(dirname "$0")/../web"

echo "=========================================="
echo "  EnjoySA 部署脚本"
echo "=========================================="

# 切换到 web 目录
cd "$WEB_DIR"
echo "[1/4] 当前目录: $(pwd)"

# 构建
echo "[2/4] 构建项目..."
npm run build

# 上传
echo "[3/4] 上传到服务器..."
scp -r dist/* ${SERVER}:${DEPLOY_PATH}/

# 验证
echo "[4/4] 验证部署..."
STATUS=$(ssh ${SERVER} "curl -s -o /dev/null -w '%{http_code}' http://localhost:6066/")

if [ "$STATUS" = "200" ]; then
    echo ""
    echo "=========================================="
    echo "  部署成功!"
    echo "  访问地址: http://43.134.28.147:6066"
    echo "=========================================="
else
    echo ""
    echo "警告: 服务返回状态码 $STATUS"
    exit 1
fi
