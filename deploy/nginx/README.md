# Nginx Configuration (managed by git)

EnjoySA 生产 nginx 配置 `/etc/nginx/sites-available/enjoysa` 由本仓库管理。

## 修改流程

1. 在仓库改 `deploy/nginx/sites-available/enjoysa`
2. 提 PR，review 后合并到 main
3. push to main 触发 `.github/workflows/deploy.yml`，自动 rsync + nginx -t + reload
4. **服务器禁止再手改 nginx 配置** — 下次 deploy 会覆盖

## 部署逻辑

deploy workflow 执行：
1. rsync `deploy/nginx/sites-available/enjoysa` 到服务器 `/tmp/enjoysa.new`
2. 备份现有配置到 `/etc/nginx/sites-available/enjoysa.bak.$(date +%Y%m%d-%H%M%S)`
3. cp `.new` 替换 `enjoysa`
4. `nginx -t` 测试；失败则 cp 备份回去 + exit 1
5. 通过则 `systemctl reload nginx`

## 重建服务器时

deploy.yml **不管 SSL 证书**。新机器需要：

1. 人工先放 SSL 证书到 `/etc/nginx/ssl/origin.crt` + `/etc/nginx/ssl/origin.key`
2. 确保 nginx 已安装 + sites-enabled 软链已建：`sudo ln -s /etc/nginx/sites-available/enjoysa /etc/nginx/sites-enabled/enjoysa`
3. 然后跑一次 deploy workflow 即同步配置

## 紧急 hotfix（绕过 PR）

只在生产严重不可用时才用：

```bash
ssh ubuntu@13.239.210.53
sudo vim /etc/nginx/sites-available/enjoysa  # 直接改
sudo nginx -t && sudo systemctl reload nginx
```

**事后必须：**
1. 把改动同步回仓库（PR）
2. 否则下次 deploy 会回退你的改动
