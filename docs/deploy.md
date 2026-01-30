# EnjoySA 部署文档

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 | 新加坡 (singapore) |
| IP | 43.134.28.147 |
| 用户 | ubuntu |
| SSH 密钥 | ~/.ssh/singpore.pem |
| 部署路径 | /opt/enjoysa |
| 访问地址 | http://43.134.28.147:6066 |

## 技术栈

- 前端: Vite + React + TypeScript
- Web 服务器: Nginx
- 端口: 6066

## Nginx 配置

配置文件位于 `/etc/nginx/sites-available/enjoysa`:

```nginx
server {
    listen 6066;
    listen [::]:6066;

    server_name _;

    root /opt/enjoysa;
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
scp -r dist/* singapore:/opt/enjoysa/
```

3. 验证部署
```bash
ssh singapore "curl -s http://localhost:6066/"
```

## 自动部署

使用部署脚本:
```bash
./scripts/deploy.sh
```

## 注意事项

1. 腾讯云安全组需开放 6066 端口入站规则
2. 部署前确保本地构建成功
3. SPA 应用使用 `try_files` 支持前端路由
