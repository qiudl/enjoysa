# EnjoySA 部署文档

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 | AWS Sydney (aws-prod) |
| IP | 13.239.210.53 |
| 用户 | ubuntu |
| SSH 密钥 | ~/.ssh/enjoysa-aws.pem |
| 前端部署路径 | /opt/enjoysa/frontend |
| 后端部署路径 | /opt/enjoysa-backend |
| 公网访问 | https://enjoysau.com |
| 内部前端访问 | http://13.239.210.53:6066 |
| 后端 health | http://13.239.210.53:6080/health |

> 历史：之前部署在腾讯云新加坡 (43.134.28.147)，2026 年随 GitHub + AWS CI/CD 迁移
> 一并迁到 AWS Sydney（commit 23ebe73）。如果还看到旧 IP 引用，按本文档为准。

## 技术栈

- 前端: Vite + React + TypeScript
- Web 服务器: Nginx
- 端口: 6066（前端）/ 6080（后端 API）

## Nginx 配置

配置文件位于 `/etc/nginx/sites-available/enjoysa`:

```nginx
server {
    listen 6066;
    listen [::]:6066;

    server_name _;

    root /opt/enjoysa/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 手动部署步骤

1. 本地构建
```bash
cd web
npm run build
```

2. 上传到服务器
```bash
rsync -avz --delete -e "ssh -i ~/.ssh/enjoysa-aws.pem" web/dist/ ubuntu@13.239.210.53:/opt/enjoysa/frontend/
```

3. 验证部署
```bash
ssh -i ~/.ssh/enjoysa-aws.pem ubuntu@13.239.210.53 "curl -s -o /dev/null -w '%{http_code}\n' http://localhost:6066/"
```

## 自动部署

```bash
./scripts/build-and-deploy.sh
```

脚本会交互式询问：
- `1` 全栈（前端 + 后端）
- `2` 仅前端（rsync `web/dist/` → `/opt/enjoysa/frontend/`）
- `3` 仅后端（rsync `backend/` → `/opt/enjoysa-backend/backend/` + `docker compose up -d --build backend`）

## 注意事项

1. AWS 安全组需开放 6066（前端入站）和 6080（后端入站）端口
2. 部署前确保本地构建成功（`npm run build` + `npm run lint`）
3. SPA 应用使用 `try_files` 支持前端路由
4. 后端容器只重启 `backend` 服务，Postgres 数据 volume 不动
