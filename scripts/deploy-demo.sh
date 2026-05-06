#!/usr/bin/env bash
# REQ-20260506-0056: 手工部署 demo.enjoysau.com 的唯一脚本
#
# 重要约束（用户 2026-05-06 明确要求）：
#   - demo 环境**禁止 AI 自动部署**，必须人工运行此脚本
#   - 不接 main push 自动触发，不接定时调度
#   - GitHub Actions workflow_dispatch (.github/workflows/deploy-demo.yml) 仍存在但
#     仅作为人工兜底入口；本脚本是首选路径
#
# 用法：
#   ./scripts/deploy-demo.sh                # full deploy（frontend + backend + nginx）
#   ./scripts/deploy-demo.sh frontend       # 只发前端
#   ./scripts/deploy-demo.sh backend        # 只发后端
#   ./scripts/deploy-demo.sh full --reset   # full deploy + 清空 demo 数据库
#
# 前置条件：
#   - 在 macOS 笔记本上运行（不是 CI）
#   - ssh enjoysa-demo 可达（~/.ssh/config 已配，~/.ssh/enjoysa-aws.pem 存在）
#   - 仓库已 git pull 到最新 main
#   - 本地装了 node 20+, npm, rsync, docker（不需要 docker 起本地服务）

set -euo pipefail

SCOPE="${1:-full}"
RESET_DB=0
[ "${2:-}" = "--reset" ] && RESET_DB=1

case "$SCOPE" in
  full|frontend|backend) ;;
  *) echo "❌ scope must be: full | frontend | backend"; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_HOST=enjoysa-demo
SERVER_IP=13.239.207.90
FRONTEND_DEPLOY=/opt/enjoysa/frontend
BACKEND_DEPLOY=/opt/enjoysa-backend

echo "────────────────────────────────────────"
echo "  Demo deploy → demo.enjoysau.com ($SERVER_IP)"
echo "  scope=$SCOPE  reset_db=$RESET_DB"
echo "────────────────────────────────────────"

# Sanity: ensure we're on main / clean tree, otherwise demo would deploy
# whatever WIP we've got. Bail out unless --force is set later.
cd "$REPO_ROOT"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Current branch is '$BRANCH', not 'main'. Continue anyway? (y/N)"
  read -r ans
  [ "$ans" = "y" ] || { echo "Aborted."; exit 1; }
fi

# Confirm before doing anything destructive
if [ "$RESET_DB" = "1" ]; then
  echo "⚠️  reset_db=1 will WIPE demo's postgres volume. Continue? (yes/N)"
  read -r ans
  [ "$ans" = "yes" ] || { echo "Aborted."; exit 1; }
fi

# Reachability check
ssh -o ConnectTimeout=5 -o BatchMode=yes "$DEMO_HOST" 'echo demo_reachable >/dev/null' || {
  echo "❌ Cannot ssh to $DEMO_HOST. Check ~/.ssh/config alias and key (~/.ssh/enjoysa-aws.pem)."
  exit 1
}

# ---- Frontend ----
if [ "$SCOPE" = "full" ] || [ "$SCOPE" = "frontend" ]; then
  echo ""
  echo "→ [1/3] Building frontend (--mode demo)"
  ( cd "$REPO_ROOT/web" && npm ci && npm run build -- --mode demo )

  echo "→ [1/3] Rsyncing dist/ to $DEMO_HOST:$FRONTEND_DEPLOY"
  ssh "$DEMO_HOST" "sudo mkdir -p $FRONTEND_DEPLOY && sudo chown -R ubuntu:ubuntu $FRONTEND_DEPLOY"
  rsync -avz "$REPO_ROOT/web/dist/" "$DEMO_HOST:$FRONTEND_DEPLOY/"
  ssh "$DEMO_HOST" "find $FRONTEND_DEPLOY/assets -type f -mtime +7 -delete 2>/dev/null || true"
fi

# ---- Backend ----
if [ "$SCOPE" = "full" ] || [ "$SCOPE" = "backend" ]; then
  echo ""
  echo "→ [2/3] Overriding config.production.yaml with demo values"
  cp "$REPO_ROOT/backend/configs/config.demo.yaml" \
     "$REPO_ROOT/backend/configs/config.production.yaml"
  trap 'cd "$REPO_ROOT" && git checkout -- backend/configs/config.production.yaml 2>/dev/null || true' EXIT

  echo "→ [2/3] Rsyncing backend to $DEMO_HOST:$BACKEND_DEPLOY"
  ssh "$DEMO_HOST" "sudo mkdir -p $BACKEND_DEPLOY && sudo chown -R ubuntu:ubuntu $BACKEND_DEPLOY"
  rsync -avz --delete \
    --exclude '.git' --exclude 'tmp' --exclude 'uploads/*' --exclude 'enjoysa-backend' \
    "$REPO_ROOT/backend/" "$DEMO_HOST:$BACKEND_DEPLOY/backend/"
  scp "$REPO_ROOT/docker-compose.yml" "$DEMO_HOST:$BACKEND_DEPLOY/docker-compose.yml"

  if [ "$RESET_DB" = "1" ]; then
    echo "→ Wiping demo postgres volume"
    ssh "$DEMO_HOST" "cd $BACKEND_DEPLOY && \
      export DB_PASSWORD='enjoysa-demo-2026' && \
      docker compose down postgres -v"
  fi

  echo "→ docker compose up -d --build --wait"
  ssh "$DEMO_HOST" "cd $BACKEND_DEPLOY && \
    export DB_PASSWORD='enjoysa-demo-2026' && \
    export JWT_SECRET='enjoysa-demo-jwt-secret-2026' && \
    export STRIPE_SECRET_KEY='' && \
    export STRIPE_WEBHOOK_SECRET='' && \
    export RESEND_API_KEY='' && \
    export AI_PROJ_BASE='' && \
    export AI_PROJ_TOKEN='' && \
    export AI_PROJ_PROJ_ID='' && \
    export AI_GLM_BASE_URL='' && \
    export AI_GLM_API_KEY='' && \
    export FEISHU_WEBHOOK_URL='' && \
    docker compose up -d --build --wait --remove-orphans"
fi

# ---- nginx ----
echo ""
echo "→ [3/3] Syncing nginx config (deploy/nginx/sites-available/enjoysa-demo)"
rsync -avz "$REPO_ROOT/deploy/nginx/sites-available/enjoysa-demo" "$DEMO_HOST:/tmp/enjoysa-demo.new"
ssh "$DEMO_HOST" 'set -e
  sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
  if [ -f /etc/nginx/sites-available/enjoysa-demo ]; then
    sudo cp /etc/nginx/sites-available/enjoysa-demo /etc/nginx/sites-available/enjoysa-demo.bak.$(date +%Y%m%d-%H%M%S)
    diff /etc/nginx/sites-available/enjoysa-demo /tmp/enjoysa-demo.new || true
  fi
  sudo cp /tmp/enjoysa-demo.new /etc/nginx/sites-available/enjoysa-demo
  sudo ln -sf /etc/nginx/sites-available/enjoysa-demo /etc/nginx/sites-enabled/enjoysa-demo
  sudo rm -f /etc/nginx/sites-enabled/default
  if ! sudo nginx -t; then
    LATEST_BAK=$(ls -t /etc/nginx/sites-available/enjoysa-demo.bak.* 2>/dev/null | head -1)
    [ -n "$LATEST_BAK" ] && sudo cp "$LATEST_BAK" /etc/nginx/sites-available/enjoysa-demo
    exit 1
  fi
  sudo systemctl reload nginx
  rm /tmp/enjoysa-demo.new
'

# ---- Verify ----
echo ""
echo "→ Verifying https://demo.enjoysau.com/"
sleep 3
HOMEPAGE=$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://demo.enjoysau.com/)
HEALTH=$(ssh "$DEMO_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:6080/health")
echo "  homepage: $HOMEPAGE"
echo "  backend /health: $HEALTH"

if [ "$HOMEPAGE" = "200" ] && [ "$HEALTH" = "200" ]; then
  echo ""
  echo "✅ Demo deployed: https://demo.enjoysau.com/"
else
  echo ""
  echo "❌ Verify failed. Check ssh $DEMO_HOST and docker logs."
  exit 1
fi
