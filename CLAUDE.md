# EnjoySA 项目指南

## 项目技能

### /deploy - 部署到新加坡服务器

当用户提到 `部署`、`deploy`、`上线` 时，参考 `.claude/skills/deploy/SKILL.md` 执行部署流程。

快速部署：
```bash
./scripts/deploy.sh
```

服务器信息：
- IP: 43.134.28.147
- 端口: 6066
- 路径: /opt/enjoysa

---

## 技术栈

- 前端: Vite + React + TypeScript
- 路由: react-router-dom
- 样式: CSS Modules
- 测试: Vitest + Storybook

## 目录结构

```
web/
├── src/
│   ├── components/   # 通用组件
│   ├── pages/        # 页面组件
│   ├── i18n/         # 国际化
│   └── types/        # 类型定义
├── scripts/          # 部署脚本
└── dist/             # 构建产物
```
