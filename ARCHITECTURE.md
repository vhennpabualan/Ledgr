# Ledgr — Architecture & Codebase Reference

Personal finance tracker. Users log expenses, set monthly budgets, track income, and manage recurring transactions. Default currency is PHP.

---

## Monorepo Structure

```
ledgr/
├── apps/
│   ├── api/          # Express + Node.js backend
│   └── web/          # React + Vite frontend (PWA)
├── packages/
│   └── types/        # Shared TypeScript types & Zod schemas (@ledgr/types)
├── package.json      # npm workspaces root
└── build.mjs         # Production build script
```

Deployed as two separate services:
- **Web** → Vercel (`build:vercel`)
- **API** → Railway (`build:railway`)

---

## Backend (`apps/api`)

**Stack:** Express 4, Node ≥20, PostgreSQL (`pg`), TypeScript, Zod validation

### Entry Point

`src/index.ts` — registers all routers, CORS, cookie-parser, rate limiting, error handler, and graceful shutdown.

### API Routes

All routes are prefixed `/api/`.

| Prefix | Router file | Notes |
|---|---|---|
| `/auth` | `auth.routes.ts` | register, login, refresh, logout, change-password, delete-account |
| `/expenses` | `expense.routes.ts` | CRUD, soft-delete, receipt upload |
| `/budgets` | `budget.routes.ts` | CRUD, status (spent/pending/remaining) |
| `/categories` | `category.routes.ts` | CRUD, archive/restore |
| `/income` | `income.routes.ts` | multi-entry income per month, balance summary |
| `/pending` | `pendingItems.routes.ts` | dashboard-level upcoming expenses |
| `/recurring` | `recurring.routes.ts` | recurring expense templates |
| `/recurring-income` | `recurringIncome.routes.ts` | recurring income templates |
| `/reports` | `report.routes.ts` | summary, trend, CSV export |
| `/wallets` | `wallet.routes.ts` | manual account balance tracking |

### Services

Business logic lives entirely in `src/services/`. Routes are thin — they validate input (Zod), call a service, return the result.

| Service | Responsibility |
|---|---|
| `auth.service.ts` | JWT sign/verify, bcrypt hashing, refresh token DB management |
| `expense.service.ts` | Expense CRUD + ledger audit entries (single transaction) |
| `budget.service.ts` | Budget CRUD + status calculation (spent, pending, remaining) |
| `category.service.ts` | Category CRUD, max 1 level of nesting enforced |
| `income.service.ts` | Multi-entry income per month, balance summary calculation |
| `wallet.service.ts` | Account balance CRUD |
| `recurring.service.ts` | Recurring expense templates, next-due-date calculation |
| `recurringIncome.service.ts` | Recurring income templates |
| `pendingItems.service.ts` | Pending/upcoming items per month |
| `pendingSpend.service.ts` | Budget-scoped pending spend |
| `report.service.ts` | Spending aggregation by category/day/week/month, CSV |
| `receiptScan.service.ts` | Gemini AI OCR — disabled if `GEMINI_API_KEY` not set |
| `storage.service.ts` | Cloudflare R2 (S3-compatible) for receipt image uploads |

### Middleware

| File | Purpose |
|---|---|
| `requireAuth.ts` | Validates Bearer JWT, attaches `req.userId` / `req.userEmail` |
| `errorHandler.ts` | Centralized error handler — maps `AppError` + `ZodError` to JSON responses |
| `rateLimit.ts` | In-memory rate limiter (10 auth req/15min; general limit on all `/api`) |
| `requestId.ts` | Attaches `X-Request-ID` to every request for log correlation |

### Database

PostgreSQL. Amounts stored as `BIGINT` in minor currency units (centavos). All timestamps are `TIMESTAMPTZ`.

**Migrations** (run in order):

| File | What it adds |
|---|---|
| `001_initial_schema.sql` | `users`, `categories`, `expenses`, `budgets`, `ledger_entries`, `refresh_tokens` |
| `002_seed_categories.sql` | System default categories (user_id NULL) |
| `003_income.sql` | `income` table (multi-entry per month) |
| `004_pending_spend.sql` | `pending_spend` (budget-scoped) |
| `005_pending_items.sql` | `pending_items` (dashboard-level) |
| `006_income_multi_entry.sql` | Drops unique constraint to allow multiple income entries per month |
| `007_performance_indexes.sql` | Additional composite indexes |
| `008_recurring_expenses.sql` | `recurring_expenses` table + `recurring_id` FK on `expenses` |
| `009_wallets.sql` | `wallets` table |
| `010_recurring_income.sql` | `recurring_income` table + `recurring_id` FK on `income` |

**Key design decisions:**
- `expenses.deleted_at` — soft delete; partial index only covers non-deleted rows
- `ledger_entries` — append-only audit log, no FK constraints, never deleted
- `categories.user_id IS NULL` — system defaults visible to all users
- `categories.parent_id` — one level of nesting max (enforced in service)
- `budgets` — unique on `(user_id, category_id, year, month)`

### Auth Flow

1. `POST /api/auth/login` → returns `accessToken` (15m JWT) in body + `refreshToken` (30d JWT) in httpOnly cookie
2. Client stores access token in React state only (never localStorage)
3. On 401, axios interceptor calls `POST /api/auth/refresh` using the cookie, retries original request
4. Logout deletes the refresh token row from DB (bcrypt hash comparison)

### Environment Variables

Validated at startup via Zod (`src/config/env.ts`). Required:

```
DATABASE_URL
JWT_SECRET           (min 32 chars)
JWT_REFRESH_SECRET   (min 32 chars)
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
GEMINI_API_KEY       (optional — disables receipt scanning if absent)
PORT                 (default 3001)
NODE_ENV
```

---

## Frontend (`apps/web`)

**Stack:** React 18, TypeScript, Vite 6, Tailwind CSS 3, React Query v5, React Router v6, Recharts, PWA (vite-plugin-pwa)

### Routing (`src/App.tsx`)

All page routes are lazy-loaded (`React.lazy`). Route tree:

```
/login                → LoginPage (public)
/ (ProtectedRoute)
  └── AppLayout
      ├── /             → DashboardPage
      ├── /expenses     → ExpensesPage
      ├── /budgets      → BudgetsPage
      ├── /reports      → ReportsPage
      ├── /categories   → CategoriesPage
      ├── /recurring    → RecurringPage
      ├── /settings     → SettingsPage
      └── /wallets      → WalletsPage
* → redirect to /
```

`ProtectedRoute` checks `isAuthenticated` from `AuthContext`. Unauthenticated users are redirected to `/login`.

### Pages

| Page | What it does |
|---|---|
| `DashboardPage` | Balance card, spending trend chart (Recharts AreaChart), recent expenses, budget rows, wallet list. Inline `IncomeModal` for adding income. |
| `ExpensesPage` | Paginated expense list with date/category/amount filters. Tap to edit via `BottomSheet` + `ExpenseForm`. |
| `BudgetsPage` | Monthly budget cards showing spent/pending/remaining. Create/edit budgets. |
| `ReportsPage` | Category breakdown + trend chart. Date range picker. CSV export. |
| `CategoriesPage` | Create/edit/archive categories. Emoji icon + hex color picker. |
| `RecurringPage` | Recurring expense templates. Pause/resume/delete. |
| `RecurringIncomePage` | Recurring income templates. (Route not in App.tsx — appears to be in progress or accessed differently.) |
| `SettingsPage` | Theme toggle, currency selector, budget alert threshold, change password, delete account. |
| `WalletsPage` | Manual account balance tracking. Create/edit/delete wallets. |
| `LoginPage` | Email/password login + register toggle. |

### Layout (`src/layouts/AppLayout.tsx`)

Single layout wrapping all authenticated pages. Renders:
- Desktop: left sidebar nav with 7 items
- Mobile: bottom nav bar (4 items + FAB for quick expense add + "More" dropdown)
- Pull-to-refresh (custom `usePullToRefresh` hook)
- Online/offline indicator (`useOnlineStatus`)
- User avatar menu (initials from JWT email) with logout

### Contexts

| Context | What it holds |
|---|---|
| `AuthContext` | `accessToken` (React state only), `setAccessToken`, `isAuthenticated`. Attempts silent refresh on mount via httpOnly cookie. |
| `SettingsContext` | `theme` (system/light/dark), `currency` (PHP/USD/EUR/GBP/JPY/SGD), `budgetAlertThreshold`. Persisted to `localStorage`. Provides `formatMoney(minorUnits)` helper. |

### API Client (`src/lib/api.ts`)

Axios instance with:
- `baseURL` from `VITE_API_BASE_URL` (falls back to `/api`)
- `withCredentials: true` for cookie-based refresh
- Request interceptor: attaches `Authorization: Bearer <token>`
- Response interceptor: on 401, calls `/auth/refresh`, retries once, redirects to `/login` on failure

Exports named API objects: `authApi`, `expensesApi`, `budgetsApi`, `categoriesApi`, `incomeApi`, `reportsApi`, `recurringApi`, `walletsApi`, `recurringIncomeApi`, `pendingApi`.

### React Query Config

```ts
staleTime: 3 * 60 * 1000   // 3 min — no refetch on navigation
gcTime:   15 * 60 * 1000   // 15 min cache retention
retry: 1
refetchOnWindowFocus: false
refetchOnReconnect: 'always'
```

### Key Components

| Component | Notes |
|---|---|
| `BottomSheet` | Mobile-friendly slide-up modal used for forms |
| `ExpenseForm` | Reusable create/edit form — used in Dashboard FAB and ExpensesPage |
| `BrandLogo` | Renders a favicon/logo for known domains (e.g. Netflix, Spotify) based on expense description |
| `DatePicker` | Custom date input component |
| `ErrorBoundary` | Catches render errors, shows fallback UI |
| `ProtectedRoute` | Auth guard using `AuthContext` |
| `UpdatePrompt` | PWA update notification |

---

## Shared Types (`packages/types`)

Published as `@ledgr/types`. Consumed by both `apps/api` and `apps/web`.

Contains:
- TypeScript interfaces for all domain entities: `Expense`, `Category`, `Budget`, `BudgetStatus`, `Income`, `BalanceSummary`, `RecurringExpense`, `RecurringIncome`, `Wallet`, `PendingItem`, `PendingSpend`, `LedgerEntry`, `AuthTokens`, etc.
- All DTO types (`CreateExpenseDTO`, `UpdateExpenseDTO`, etc.)
- Zod schemas (`src/schemas.ts`) used for request validation on the API

---

## Known Gaps / Things to Be Aware Of

- `RecurringIncomePage` exists as a file (`src/pages/RecurringIncomePage.tsx`) but is not registered in `App.tsx` routing — it may be unreachable or accessed via a sub-route not visible here.
- Rate limiting is in-memory — will not work correctly across multiple API instances. Redis is the documented next step.
- `expense.splits` is always `[]` — multi-user split expenses are reserved for a future version.
- Receipt scanning (`receiptScan.service.ts`) is silently disabled when `GEMINI_API_KEY` is absent — no UI indication of this.
- The `income` table originally had a unique constraint on `(user_id, year, month)` (migration 003) that was dropped in migration 006 to support multiple income entries per month. The `UpsertIncomeDTO` name is a legacy artifact — it's now an add operation.
