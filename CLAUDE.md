# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnjoySA (畅游南澳) — a tourism platform for South Australia with three user roles: C-end consumers, B-end suppliers, and platform admins. Deployed at https://enjoysau.com.

## Tech Stack

- **Frontend**: Vite 7 + React 19 + TypeScript + CSS Modules (in `web/`)
- **Backend**: Go 1.24 + PostgreSQL 16 (in `backend/`)
- **Infra**: Docker Compose, Nginx reverse proxy on Singapore server

## Commands

```bash
# Frontend
cd web && npm run dev          # Dev server (proxies /api & /uploads to localhost:6080)
cd web && npm run build        # Type-check + production build
cd web && npm run lint         # ESLint
cd web && npm run test         # Unit tests (vitest, jsdom)
cd web && npm run storybook    # Storybook on port 6006

# Backend
cd backend && go run ./cmd/server   # Start API server (port 6080)
cd backend && go run ./cmd/seed     # Seed database

# Full stack (Docker)
docker compose up -d           # Postgres (port 6054) + backend (port 6080)

# Deploy
./scripts/deploy.sh            # Build frontend + deploy to server 43.134.28.147:6066
```

## Architecture

### Frontend (`web/src/`)

**Three-tier auth system** with separate contexts and token storage per role:
- `UserAuthContext` — C-end consumers (token: `enjoysa_user_token`)
- `SupplierAuthContext` — B-end suppliers (token: `enjoysa_supplier_token`)
- `AdminAuthContext` — platform admins (token: `enjoysa_admin_token`)

**Routing pattern**: `App.tsx` defines all routes. Each page has a `*Wrapper` component in App.tsx that bridges router hooks (useNavigate, useParams) into page props — pages themselves are router-agnostic and receive callbacks. All non-homepage pages are React.lazy loaded.

**Auth guards**: `SupplierAuthGuard` and `AdminAuthGuard` protect B-end/admin routes. Admin routes use `requiredPermission` prop for RBAC (e.g., `"suppliers.view"`).

**Layouts**: Supplier pages wrap in `SupplierLayout`, admin pages wrap in `AdminLayout`. C-end pages manage their own Header/Footer.

**API layer**: `services/api.ts` provides a base HTTP client with JWT auto-refresh. Domain services (`productService.ts`, `orderService.ts`, etc.) build on it. API base: `/api/v1` (configurable via `VITE_API_BASE`).

**State**: React Context for auth and cart (`CartContext`). No external state library.

### Backend (`backend/internal/`)

Domain-driven packages: `product`, `order`, `supplier`, `admin`, `auth`, `payment`, `settlement`, `rbac`, `chat`, `upload`, etc. Router in `internal/router/`. Database migrations in `migrations/`. Models in `internal/models/`.

### Key integrations
- Google OAuth (`@react-oauth/google`)
- Stripe payments
- Resend for email

## i18n

All user-visible text must use `react-i18next`. Two locale files must stay in sync:
- `web/src/i18n/locales/zh-CN.json` (Chinese)
- `web/src/i18n/locales/en-US.json` (English)

Key format: `namespace.key` (e.g., `auth.loginTitle`, `supplier.dashboard`).

## CSS Convention

CSS Modules (`*.module.css`) per component. Global variables in `web/src/styles/variables.css`. Use `clsx` for conditional class merging.
