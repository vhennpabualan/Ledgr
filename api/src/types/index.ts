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
  /** ID of recurring template that created this expense */
  recurringId?: string | null;
  /** ID of wallet this expense was paid from (null = salary/bank balance) */
  walletId?: string | null;
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
  /** ID of recurring template that created this income entry */
  recurringId?: string | null;
}

export interface UpsertIncomeDTO {
  amount: number;
  currency?: string;
  year: number;
  month: number;
  label?: string;
}

/** DTO for adding a new income entry (replaces upsert for multi-entry flow) */
export type AddIncomeDTO = UpsertIncomeDTO;

/** DTO for patching an existing income entry */
export interface PatchIncomeDTO {
  amount?: number;
  label?: string;
}

export interface BalanceSummary {
  income: Income | null;
  /** Sum of all income entries this month */
  totalIncome: number;
  /** All income entries this month */
  entries: Income[];
  totalSpent: number;
  /** Sum of all pending items this month */
  pendingTotal: number;
  /** totalIncome - totalSpent */
  remaining: number;
  /** totalIncome - totalSpent - pendingTotal */
  remainingAfterPending: number;
  percentSpent: number;
}

// ─── Recurring Expenses ──────────────────────────────────────────────────────

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: string;
  userId: string;
  /** Positive integer in minor currency units */
  amount: number;
  currency: string;
  categoryId: string;
  description: string | null;
  frequency: RecurringFrequency;
  /** For monthly/yearly: day of month (1-31) */
  dayOfMonth: number | null;
  /** For weekly: day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number | null;
  /** For yearly: month of year (1-12) */
  monthOfYear: number | null;
  /** When this recurring expense starts */
  startDate: string;
  /** When this recurring expense ends (null = indefinite) */
  endDate: string | null;
  /** Next scheduled due date */
  nextDueDate: string;
  /** When the last expense was created */
  lastRunAt: string | null;
  /** Whether this recurring expense is paused */
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringDTO {
  amount: number;
  currency?: string;
  categoryId: string;
  description?: string;
  frequency: RecurringFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  monthOfYear?: number;
  startDate?: string;
  endDate?: string;
}

export type UpdateRecurringDTO = Partial<CreateRecurringDTO> & {
  isPaused?: boolean;
};

// ─── Recurring Income ─────────────────────────────────────────────────────────

export type RecurringIncomeFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringIncome {
  id: string;
  userId: string;
  /** Positive integer in minor currency units */
  amount: number;
  currency: string;
  label: string;
  frequency: RecurringIncomeFrequency;
  /** For weekly/biweekly: day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number | null;
  /** For monthly/yearly: day of month (1-31) */
  dayOfMonth: number | null;
  /** For yearly: month of year (1-12) */
  monthOfYear: number | null;
  /** When this recurring income starts */
  startDate: string;
  /** When this recurring income ends (null = indefinite) */
  endDate: string | null;
  /** Next scheduled due date */
  nextDueDate: string;
  /** When the last income entry was created */
  lastRunAt: string | null;
  /** Whether this recurring income is paused */
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringIncomeDTO {
  amount: number;
  currency?: string;
  label?: string;
  frequency: RecurringIncomeFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate?: string;
  endDate?: string;
}

export type UpdateRecurringIncomeDTO = Partial<CreateRecurringIncomeDTO> & {
  isPaused?: boolean;
};

// ─── Wallets ──────────────────────────────────────────────────────────────────

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  /** Balance in minor currency units (can be 0 or negative) */
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletDTO {
  name: string;
  balance: number;
  currency?: string;
}

export interface UpdateWalletDTO {
  name?: string;
  balance?: number;
  currency?: string;
}

// ─── Money formatting ─────────────────────────────────────────────────────────

export type SupportedCurrency = 'PHP' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD';

const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
  PHP: 'en-PH',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  SGD: 'en-SG',
};

// Cache formatters — Intl.NumberFormat construction is expensive
const _formatterCache = new Map<SupportedCurrency, Intl.NumberFormat>();

function _getFormatter(currency: SupportedCurrency): Intl.NumberFormat {
  let f = _formatterCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    });
    _formatterCache.set(currency, f);
  }
  return f;
}

/**
 * Format an amount stored in minor currency units (e.g. centavos) as a
 * human-readable currency string.
 *
 * @param minorUnits - integer amount in minor units (e.g. 12345 = ₱123.45)
 * @param currency   - ISO 4217 code; defaults to 'PHP'
 *
 * @example
 *   formatMoney(12345)         // "₱123.45"
 *   formatMoney(9900, 'USD')   // "$99.00"
 */
export function formatMoney(minorUnits: number, currency: SupportedCurrency = 'PHP'): string {
  return _getFormatter(currency).format(minorUnits / 100);
}

