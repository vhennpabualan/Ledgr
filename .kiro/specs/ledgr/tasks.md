# Implementation Plan: Ledgr — Expenses Management

## Overview

Incremental build from data layer outward: DB schema → backend services → API routes → frontend shell → feature screens. Each step is independently testable. Property-based tests (fast-check) are placed immediately after the unit they validate.

## Tasks

- [x] 1. Project scaffolding and shared infrastructure
  - [x] 1.1 Initialize monorepo structure with `/apps/api` (Node.js/Express + TypeScript) and `/apps/web` (Vite + React + TypeScript + Tailwind)
    - Configure `tsconfig.json`, `eslint`, `prettier` for both apps
    - Add shared `/packages/types` package exporting all TypeScript interfaces from the design (`Expense`, `Budget`, `Category`, `LedgerEntry`, `AuthTokens`, DTOs, filter types)
    - _Requirements: 2.1, 3.1, 6.1_
  - [x] 1.2 Configure environment variable handling
    - `apps/api`: `DATABASE_URL` (Neon), `R2_*` (Cloudflare), `JWT_SECRET`, `JWT_REFRESH_SECRET`
    - `apps/web`: `VITE_API_BASE_URL`
    - Use `zod` to parse and validate env vars at startup — fail fast if missing
    - _Requirements: 11.1_

- [x] 2. Database schema and migrations
  - [x] 2.1 Write SQL migration: `users`, `categories`, `expenses`, `budgets`, `ledger_entries` tables
    - `expenses`: `id UUID PK`, `user_id`, `amount BIGINT NOT NULL CHECK (amount > 0)`, `currency CHAR(3)`, `date DATE`, `category_id`, `description`, `receipt_url`, `deleted_at`, `created_at`, `updated_at`
    - `budgets`: unique constraint on `(user_id, category_id, year, month)`
    - `ledger_entries`: no FK to allow append-only; `diff JSONB`
    - `categories`: `parent_id` self-reference; `user_id` nullable for system defaults
    - Add indexes: `expenses(user_id, date DESC)`, `expenses(user_id, category_id, date)`, `ledger_entries(entity_id, entity_type)`
    - _Requirements: 2.2, 6.2, 9.1, 9.2, 11.1, 11.2_
  - [x] 2.2 Seed system-default categories
    - Insert categories with `user_id = NULL`: Food, Transport, Housing, Health, Entertainment, Shopping, Other
    - _Requirements: 5.6_

- [x] 3. Zod validation schemas (shared)
  - [x] 3.1 Write Zod schemas for all request payloads in `/packages/types/src/schemas.ts`
    - `CreateExpenseSchema`: `amount` (positive int, ≤ 99999999), `currency` (ISO 4217 enum or regex), `date` (ISO 8601, ≤ today+7d), `categoryId` (UUID), `description` (optional string), `receiptUrl` (optional URL)
    - `UpdateExpenseSchema`: all fields optional via `.partial()`
    - `CreateBudgetSchema`: `limitAmount` (positive int), `month` (1–12), `year`, `categoryId`, `currency`, `rollover`
    - `CreateCategorySchema`: `name` (trimmed, 1–50 chars), `icon`, `color` (hex), `parentId` (optional UUID)
    - `ExpenseFiltersSchema`: `from`, `to`, `categoryIds`, `minAmount`, `maxAmount`, `page`, `pageSize` (max 100)
    - _Requirements: 2.3, 2.4, 2.5, 3.3, 6.3, 6.4, 10.1_
  - [ ]* 3.2 Write property tests for Zod schemas
    - **Property 3: Invalid amounts are rejected** — generate amounts ≤ 0 and > 99999999; assert schema rejects all
    - **Property 4: Future-date boundary enforcement** — generate dates > today+7d; assert schema rejects all
    - **Property 5: Invalid currency codes are rejected** — generate arbitrary non-ISO-4217 strings; assert schema rejects all
    - **Validates: Requirements 2.3, 2.4, 2.5, 10.1**

- [x] 4. Auth Service
  - [x] 4.1 Implement `AuthService` in `apps/api/src/services/auth.service.ts`
    - `login()`: verify credentials against `users` table, issue JWT access token (15 min) + refresh token (30 days)
    - `refresh()`: validate refresh token from httpOnly cookie, issue new access token
    - `logout()`: clear refresh token cookie
    - `validateToken()`: verify and decode access token; return `TokenPayload`
    - Store refresh token hash in DB for invalidation on logout
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 4.2 Implement auth middleware `requireAuth` that calls `validateToken()` and attaches `userId` to `req`
    - Return `{ error: "UNAUTHORIZED" }` + 401 on failure
    - _Requirements: 1.6, 10.4_
  - [x] 4.3 Wire auth routes: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
    - Set refresh token as `httpOnly; Secure; SameSite=Strict` cookie
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 5. Category Service and routes
  - [x] 5.1 Implement `CategoryService` in `apps/api/src/services/category.service.ts`
    - `createCategory()`: validate name (trimmed, ≤ 50 chars), check `parentId` depth (reject if parent already has a parent), persist with `userId`
    - `listCategories(userId)`: return user-owned + system-default (`user_id IS NULL`) categories
    - `archiveCategory(id, userId)`: set `isArchived = true`
    - `deleteCategory(id, userId)`: reject with 403 if `userId = null` (system category); soft-delete otherwise
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 5.2 Write property tests for CategoryService
    - **Property 12: Category depth constraint** — generate categories with grandparent `parentId`; assert 400 returned
    - **Property 13: System categories are undeletable** — generate delete requests for `userId=null` categories; assert 403 returned
    - **Validates: Requirements 5.3, 5.4**
  - [x] 5.3 Wire category routes under `requireAuth`: `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`
    - _Requirements: 5.1, 5.4, 5.6_

- [x] 6. Expense Service — core CRUD
  - [x] 6.1 Implement `ExpenseService.createExpense()` in `apps/api/src/services/expense.service.ts`
    - Validate payload via `CreateExpenseSchema`; verify `categoryId` belongs to user or is a system category
    - Insert expense row; append `LedgerEntry` with `action: 'create'` and full snapshot in `diff`
    - Return created expense; `splits` always set to `[]`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 11.4_
  - [ ]* 6.2 Write property tests for expense creation
    - **Property 1: Expense creation round-trip** — generate valid payloads; create then retrieve; assert field equality
    - **Property 2: Amount stored as positive integer in minor units** — assert `amount` in DB response is always a positive integer
    - **Property 21: Splits are always empty in v1** — assert `splits === []` on every created expense
    - **Validates: Requirements 2.1, 2.2, 11.4**
  - [x] 6.3 Implement `ExpenseService.listExpenses()` with filter and pagination
    - Apply `ExpenseFiltersSchema`; enforce `WHERE deleted_at IS NULL` always; enforce `WHERE user_id = $userId` always
    - Max page size 100; return `{ data, total, page, pageSize }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 6.4 Write property tests for expense listing
    - **Property 6: Soft-deleted expenses are universally excluded** — create expenses, soft-delete some, assert none appear in list
    - **Property 7: User data isolation** — create expenses for two users; assert each user's list contains only their own records
    - **Property 8: Filter correctness** — generate random filter combos; assert every returned expense satisfies all filters
    - **Property 9: Pagination size invariant** — assert `data.length <= 100` for any page request
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [x] 6.5 Implement `ExpenseService.getExpense()`, `updateExpense()`, `deleteExpense()`
    - `getExpense()`: return 404 if not found or `userId` mismatch
    - `updateExpense()`: apply partial patch; append `LedgerEntry` with `action: 'update'` and diff of changed fields only
    - `deleteExpense()`: set `deletedAt = NOW()`; append `LedgerEntry` with `action: 'delete'`
    - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 11.3_
  - [ ]* 6.6 Write property tests for expense update and delete
    - **Property 10: Expense update round-trip** — generate valid patches; update then retrieve; assert patched fields updated, others unchanged
    - **Property 11: Soft-delete preserves row** — delete expense; assert row still exists in DB with non-null `deletedAt`; assert total row count unchanged
    - **Property 20: Ledger diff minimality** — update with known changed fields; assert `diff` contains exactly those fields
    - **Validates: Requirements 4.1, 4.3, 4.4, 9.3**
  - [x] 6.7 Wire expense routes under `requireAuth`
    - `POST /expenses`, `GET /expenses`, `GET /expenses/:id`, `PATCH /expenses/:id`, `DELETE /expenses/:id`
    - Apply `requireAuth` middleware; return structured error responses per design
    - _Requirements: 2.1, 3.1, 4.1, 4.4, 10.1, 10.2_

- [x] 7. Checkpoint — backend core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Receipt upload
  - [x] 8.1 Implement `generatePresignedUploadUrl()` in `apps/api/src/services/storage.service.ts`
    - Use Cloudflare R2 S3-compatible SDK to generate a pre-signed PUT URL with 15-minute expiry
    - Key format: `receipts/{userId}/{expenseId}/{filename}`
    - _Requirements: 8.1_
  - [x] 8.2 Wire `POST /expenses/:id/receipt-url` route
    - Validate that expense belongs to authenticated user; return `{ uploadUrl, receiptUrl }`
    - `receiptUrl` is the public/CDN URL stored on the expense record (not the pre-signed URL)
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 9. Budget Service and routes
  - [x] 9.1 Implement `BudgetService` in `apps/api/src/services/budget.service.ts`
    - `createBudget()`: validate via `CreateBudgetSchema`; enforce unique `(userId, categoryId, year, month)` — return 409 on conflict
    - `getBudgetStatus()`: aggregate non-deleted expenses for `(userId, categoryId, year, month)`; compute `spent`, `remaining`, `percentUsed`, `isOverBudget`, `thresholdReached` (≥ 80%)
    - `listBudgets()`: return all budgets for user in given period
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [ ]* 9.2 Write property tests for BudgetService
    - **Property 14: Budget arithmetic invariant** — generate budgets and expense sets; assert `remaining = limitAmount - spent`, `percentUsed = (spent/limitAmount)*100`, `isOverBudget = spent >= limitAmount`, threshold flag set when `percentUsed >= 80`
    - **Property 15: Budget uniqueness constraint** — submit two identical `(categoryId, year, month)` budgets; assert second returns 409
    - **Validates: Requirements 6.2, 6.5, 6.6, 6.7**
  - [x] 9.3 Wire budget routes under `requireAuth`
    - `POST /budgets`, `GET /budgets`, `GET /budgets/:id/status`
    - _Requirements: 6.1, 6.5_

- [x] 10. Report Service and routes
  - [x] 10.1 Implement `ReportService.getSummary()` and `getTrend()` in `apps/api/src/services/report.service.ts`
    - `getSummary()`: aggregate non-deleted expenses by `groupBy` param (`category`, `day`, `week`, `month`); return `totalSpent`, `breakdown[]`, `topExpenses[]`
    - `getTrend()`: return time-series `TrendPoint[]` for the period
    - Enforce `user_id = $userId` and `deleted_at IS NULL` on all queries
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  - [ ]* 10.2 Write property tests for ReportService
    - **Property 6 (report path): Soft-deleted expenses excluded from aggregations** — assert deleted expenses never appear in summary or trend
    - **Property 16: Report grouping correctness** — generate expense sets; assert each data point aggregates only expenses within its group boundary; assert no expense counted twice
    - **Validates: Requirements 7.2, 7.3, 7.6**
  - [x] 10.3 Implement `ReportService.exportCSV()`
    - Stream CSV rows: `date,amount,currency,category,description`
    - Use `Content-Disposition: attachment; filename="ledgr-export.csv"` header
    - _Requirements: 7.4_
  - [ ]* 10.4 Write property test for CSV export
    - **Property 17: CSV export round-trip** — generate expense set; export CSV; parse back; assert fields match originals
    - **Validates: Requirements 7.4**
  - [x] 10.5 Wire report routes under `requireAuth`
    - `GET /reports/summary`, `GET /reports/trend`, `GET /reports/export`
    - _Requirements: 7.1, 7.3, 7.4_

- [x] 11. Ledger integrity tests
  - [ ]* 11.1 Write property tests for ledger append-only invariant
    - **Property 18: Ledger append-only invariant** — run sequences of create/update/delete; assert ledger row count increases by exactly 1 per operation and never decreases
    - **Property 19: Ledger entry completeness** — assert every LedgerEntry has non-null `userId`, `entityType`, `entityId`, `action`, `timestamp`
    - **Validates: Requirements 9.1, 9.2, 9.4**

- [x] 12. Checkpoint — full backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend: shell, routing, and auth
  - [x] 13.1 Set up React app shell in `apps/web`
    - Configure React Router v6 with routes: `/login`, `/`, `/expenses`, `/budgets`, `/reports`
    - Implement `ProtectedRoute` wrapper that redirects to `/login` if no valid session
    - Create `AuthContext` + `useAuth` hook backed by React Query for session state
    - _Requirements: 1.1, 1.4_
  - [x] 13.2 Build Login page (`/login`)
    - Form: email + password fields, submit button
    - On success: store access token in memory (not localStorage); refresh token handled via httpOnly cookie
    - On failure: display inline error
    - Loading, error, and empty states required
    - _Requirements: 1.1, 1.4, 1.6_
  - [x] 13.3 Implement axios/fetch API client in `apps/web/src/lib/api.ts`
    - Attach `Authorization: Bearer <token>` header on every request
    - On 401 response: attempt `POST /auth/refresh`; if refresh succeeds, retry original request; if fails, redirect to `/login`
    - _Requirements: 1.3, 1.4_

- [x] 14. Frontend: expense management
  - [x] 14.1 Build `ExpenseList` page (`/expenses`)
    - Table/list of expenses with columns: date, category (icon + name), description, amount
    - Filter bar: date range picker, category multi-select, amount range inputs
    - Pagination controls
    - Loading skeleton, empty state ("No expenses yet"), error state
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 14.2 Build `ExpenseForm` component (used for create and edit)
    - Fields: amount (PHP default), currency selector, date picker, category selector, description (optional), receipt upload button
    - Client-side validation mirroring Zod schemas (amount > 0, date ≤ today+7d)
    - On submit: `POST /expenses` or `PATCH /expenses/:id`; invalidate React Query cache on success
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.8_
  - [x] 14.3 Implement receipt upload flow in `ExpenseForm`
    - On file select: call `POST /expenses/:id/receipt-url` to get pre-signed URL; PUT file directly to R2; store returned `receiptUrl` on expense
    - Show upload progress indicator; show thumbnail preview after upload
    - _Requirements: 8.1, 8.2_
  - [x] 14.4 Implement soft-delete confirmation dialog
    - "Delete" action on expense row opens confirmation modal; on confirm calls `DELETE /expenses/:id`; invalidates cache
    - _Requirements: 4.4_

- [x] 15. Frontend: category management
  - [x] 15.1 Build `CategoryManager` component (accessible from settings or expense form)
    - List all categories (user + system defaults); show archived separately
    - Create form: name, icon (emoji picker or text input), color (hex input), optional parent category selector (one level only)
    - Archive button on user-owned categories; delete blocked for system categories (hide or disable button)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 16. Frontend: budget management
  - [x] 16.1 Build `BudgetList` page (`/budgets`)
    - List budgets for current month; show `BudgetStatus` card per budget: category name, limit, spent, remaining, progress bar
    - Progress bar color: green < 80%, amber 80–99%, red ≥ 100%
    - _Requirements: 6.5, 6.6, 6.7_
  - [x] 16.2 Build `BudgetForm` component
    - Fields: category selector, limit amount, currency, month/year picker, rollover toggle
    - On 409 conflict: show inline message "A budget already exists for this period"
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 17. Frontend: reports and analytics
  - [x] 17.1 Build `ReportsPage` (`/reports`)
    - Date range picker + groupBy selector (`category`, `day`, `week`, `month`)
    - Summary card: total spent, top 3 categories
    - Pie/donut chart (Recharts) for category breakdown
    - Line chart (Recharts) for spending trend
    - Loading, empty, and error states
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 17.2 Implement CSV export button on `ReportsPage`
    - Call `GET /reports/export` with current filters; trigger browser download via `Content-Disposition` header
    - _Requirements: 7.4_

- [x] 18. Final checkpoint — full stack integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- PHP (Philippine Peso) is the default currency throughout the UI; currency selector still available
- `splits` field exists in the DB schema and TypeScript types but is never populated or exposed in v1 — see Requirements 11.4
- Property tests use `fast-check`; place them in `*.property.test.ts` files alongside the service under test
- Unit/integration tests use the project's standard test runner (Vitest recommended for the monorepo)
- All monetary values flow as integers (minor units) end-to-end — never convert to float in business logic
