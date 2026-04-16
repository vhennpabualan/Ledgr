export * from "./schemas";

// ─── Expense ─────────────────────────────────────────────────────────────────

export interface SplitEntry {
  userId: string;
  /** Share in minor currency units */
  amount: number;
  settled: boolean;
}

export interface Expense {
  id: string;
  userId: string;
  /** Positive integer in minor currency units (centavos for PHP) */
  amount: number;
  /** ISO 4217 currency code, default "PHP" */
  currency: string;
  /** ISO 8601 date string (date only, no time — avoids TZ issues) */
  date: string;
  categoryId: string;
  description: string | null;
  receiptUrl: string | null;
  /** Reserved for future multi-user support; always [] in v1 */
  splits: SplitEntry[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  /** null = system default category */
  userId: string | null;
  /** Trimmed, max 50 chars */
  name: string;
  /** Emoji or icon identifier */
  icon: string;
  /** Hex color string */
  color: string;
  /** Supports one level of nesting only */
  parentId: string | null;
  isArchived: boolean;
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  /** Positive integer in minor currency units */
  limitAmount: number;
  currency: string;
  year: number;
  /** 1–12 */
  month: number;
  rollover: boolean;
  createdAt: string;
}

export interface BudgetStatus {
  budget: Budget;
  /** Total spent in minor units */
  spent: number;
  /** Total pending (committed, not yet paid) in minor units */
  pending: number;
  /** limitAmount - spent - pending */
  remaining: number;
  /** (spent / limitAmount) * 100 */
  percentUsed: number;
  /** spent >= limitAmount */
  isOverBudget: boolean;
  /** percentUsed >= 80 */
  thresholdReached: boolean;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  id: string;
  entityType: 'expense' | 'budget';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  /** ID of the user who performed the action */
  userId: string;
  /** Full snapshot on create/delete; only changed fields on update */
  diff: Record<string, unknown>;
  timestamp: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  /** Short-lived (15 min) */
  accessToken: string;
  /** Long-lived (30 days), stored in httpOnly cookie */
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface Credentials {
  email: string;
  password: string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateExpenseDTO {
  /** Positive integer in minor currency units */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** ISO 8601 date string */
  date: string;
  categoryId: string;
  description?: string;
  receiptUrl?: string;
  // splitWith reserved for future multi-user support — not exposed in v1
}

export type UpdateExpenseDTO = Partial<CreateExpenseDTO>;

export interface CreateBudgetDTO {
  categoryId: string;
  /** Positive integer in minor currency units */
  limitAmount: number;
  currency: string;
  year: number;
  /** 1–12 */
  month: number;
  rollover: boolean;
}

export interface CreateCategoryDTO {
  name: string;
  icon: string;
  color: string;
  parentId?: string;
}

// ─── Filters & Pagination ────────────────────────────────────────────────────

export interface ExpenseFilters {
  /** ISO 8601 date string */
  from?: string;
  /** ISO 8601 date string */
  to?: string;
  categoryIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  page: number;
  /** Max 100 */
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportParams {
  userId: string;
  /** ISO 8601 date string */
  from: string;
  /** ISO 8601 date string */
  to: string;
  groupBy: 'category' | 'day' | 'week' | 'month';
  categoryIds?: string[];
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  totalSpent: number;
  percentage: number;
}

export interface ReportSummary {
  totalSpent: number;
  currency: string;
  breakdown: CategoryBreakdown[];
  topExpenses: Expense[];
}

export interface TrendPoint {
  /** Label for the time bucket (e.g. "2024-06", "2024-06-15") */
  label: string;
  totalSpent: number;
}

// ─── Pending Spend ────────────────────────────────────────────────────────────

export interface PendingSpend {
  id: string;
  userId: string;
  budgetId: string;
  /** Positive integer in minor currency units */
  amount: number;
  label: string;
  createdAt: string;
}

export interface CreatePendingSpendDTO {
  amount: number;
  label: string;
}

// ─── Pending Items (dashboard-level upcoming expenses) ────────────────────────

export interface PendingItem {
  id: string;
  userId: string;
  label: string;
  /** Positive integer in minor currency units */
  amount: number;
  currency: string;
  categoryId: string | null;
  year: number;
  /** 1–12 */
  month: number;
  createdAt: string;
}

export interface CreatePendingItemDTO {
  label: string;
  amount: number;
  currency?: string;
  categoryId?: string;
  year: number;
  month: number;
}

export interface Income {
  id: string;
  userId: string;
  /** Positive integer in minor currency units */
  amount: number;
  currency: string;
  year: number;
  /** 1–12 */
  month: number;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertIncomeDTO {
  amount: number;
  currency?: string;
  year: number;
  month: number;
  label?: string;
}

export interface BalanceSummary {
  income: Income | null;
  totalSpent: number;
  /** Sum of all pending items this month */
  pendingTotal: number;
  /** income - totalSpent */
  remaining: number;
  /** income - totalSpent - pendingTotal */
  remainingAfterPending: number;
  percentSpent: number;
}
