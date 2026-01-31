# EnjoySA 项目指南

## 项目信息

| 项目 | 值 |
|------|-----|
| 项目名称 | EnjoySA 畅游南澳 |
| Git 仓库 | `https://gitea.pipexerp.com/qiudl/enjoysa.git` |
| 技术栈 | Vite + React 18 + TypeScript + CSS Modules |
| 部署地址 | http://43.134.28.147:6066 |

---

## 项目技能

### /deploy - 部署到新加坡服务器

当用户提到 `部署`、`deploy`、`上线` 时，参考 `~/.claude/skills/enjoysa-deploy/SKILL.md` 执行部署流程。

快速部署：
```bash
./scripts/deploy.sh
```

服务器信息：
- IP: 43.134.28.147
- 端口: 6066
- 路径: /opt/enjoysa

---

## 目录结构

```
enjoysa/
├── web/
│   ├── src/
│   │   ├── components/       # 通用组件
│   │   │   ├── Common/       # Header, Footer, LanguageSwitcher
│   │   │   ├── Auth/         # LoginForm, RegisterForm
│   │   │   └── Supplier/     # 供应商相关组件
│   │   ├── pages/            # 页面组件
│   │   ├── i18n/             # 国际化
│   │   │   └── locales/      # zh-CN.json, en-US.json
│   │   └── types/            # 类型定义
│   ├── scripts/              # 部署脚本
│   └── dist/                 # 构建产物
├── backend/                  # Go 后端 (规划中)
└── docs/                     # 文档
```

---

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 首页 |
| `/login` | LoginPage | C端用户登录/注册 |
| `/supplier/login` | SupplierLoginPage | B端供应商登录 |
| `/supplier/register` | SupplierRegisterPage | 供应商入驻申请 |
| `/supplier/*` | Supplier 后台 | 仪表盘/产品/订单/财务 |
| `/admin/login` | AdminLoginPage | 管理员登录 |
| `/terms` | TermsPage | 服务条款 |
| `/privacy` | PrivacyPage | 隐私政策 |

---

## i18n 国际化规范

### 翻译文件

```
web/src/i18n/locales/
├── zh-CN.json    # 简体中文
└── en-US.json    # 英文
```

### 使用方式

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  return <h1>{t('brand.name')}</h1>;
};
```

### 重要规范

1. **禁止硬编码**：所有用户可见文本必须使用 i18n
2. **同步更新**：zh-CN.json 和 en-US.json 必须同时添加新 key
3. **命名规范**：使用 `namespace.key` 格式，如 `auth.loginTitle`

### 主要命名空间

- `brand.*` - 品牌信息
- `auth.*` - 登录注册
- `terms.*` / `privacy.*` - 条款政策
- `supplier.*` - 供应商模块
- `admin.*` - 管理员模块
- `common.*` - 通用文本
- `footer.*` - 页脚

---

## 本地开发

```bash
# 启动开发服务器
cd web && npm run dev

# 构建
npm run build

# 部署
./scripts/deploy.sh
```
