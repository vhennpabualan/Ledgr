import axios, { type InternalAxiosRequestConfig } from 'axios';
import type {
  Expense,
  Category,
  Budget,
  BudgetStatus,
  PendingSpend,
  CreatePendingSpendDTO,
  PendingItem,
  CreatePendingItemDTO,
  ReportSummary,
  TrendPoint,
  PaginatedResult,
  CreateExpenseDTO,
  UpdateExpenseDTO,
  CreateBudgetDTO,
  CreateCategoryDTO,
  ExpenseFilters,
  Income,
  UpsertIncomeDTO,
  BalanceSummary,
  RecurringExpense,
  CreateRecurringDTO,
  UpdateRecurringDTO,
  Wallet,
  CreateWalletDTO,
  UpdateWalletDTO,
  RecurringIncome,
  CreateRecurringIncomeDTO,
  UpdateRecurringIncomeDTO,
} from '@ledgr/types';

// ─── Token store ──────────────────────────────────────────────────────────────
// Can't use React hooks in a module — use a plain variable instead.

let _accessToken: string | null = null;

export function setApiToken(token: string | null): void {
  _accessToken = token;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true, // send httpOnly refresh-token cookie automatically
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers.set('Authorization', `Bearer ${_accessToken}`);
  }
  return config;
});

// ─── Response interceptor — 401 → refresh → retry ────────────────────────────

// Extend config type to carry a retry flag so we don't loop infinitely.
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config as RetryableConfig;

    if (error.response?.status === 401 && !originalConfig._retried) {
      originalConfig._retried = true;

      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        setApiToken(data.accessToken);
        originalConfig.headers.set('Authorization', `Bearer ${data.accessToken}`);

        return api(originalConfig);
      } catch {
        setApiToken(null);
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<{ accessToken: string }>('/auth/login', data),

  register: (data: { email: string; password: string }) =>
    api.post('/auth/register', data),

  refresh: () =>
    api.post<{ accessToken: string }>('/auth/refresh'),

  logout: () =>
    api.post('/auth/logout'),
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expensesApi = {
  create: (data: CreateExpenseDTO & { walletId?: string }) =>
    api.post<Expense>('/expenses', data),

  list: (filters?: Partial<ExpenseFilters>) =>
    api.get<PaginatedResult<Expense>>('/expenses', { params: filters }),

  get: (id: string) =>
    api.get<Expense>(`/expenses/${id}`),

  update: (id: string, data: UpdateExpenseDTO) =>
    api.patch<Expense>(`/expenses/${id}`, data),

  delete: (id: string) =>
    api.delete(`/expenses/${id}`),

  getReceiptUrl: (id: string, filename: string) =>
    api.post<{ uploadUrl: string; receiptUrl: string }>(`/expenses/${id}/receipt-url`, { filename }),

  deleteReceipt: (id: string) =>
    api.delete<Expense>(`/expenses/${id}/receipt`),

  /** Send an image file to the backend for Gemini-powered receipt scanning. */
  scanReceipt: (file: File) => {
    const form = new FormData();
    form.append('receipt', file);
    return api.post<{
      amount: number | null;
      date: string | null;
      description: string | null;
      currency: string | null;
      confidence: 'high' | 'low';
    }>('/expenses/scan-receipt', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () =>
    api.get<Category[]>('/categories'),

  create: (data: CreateCategoryDTO) =>
    api.post<Category>('/categories', data),

  patch: (id: string, data: Partial<CreateCategoryDTO>) =>
    api.patch<Category>(`/categories/${id}`, data),

  delete: (id: string) =>
    api.delete(`/categories/${id}`),
};

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const budgetsApi = {
  create: (data: CreateBudgetDTO) =>
    api.post<Budget>('/budgets', data),

  list: (year: number, month: number) =>
    api.get<Budget[]>('/budgets', { params: { year, month } }),

  getStatus: (id: string) =>
    api.get<BudgetStatus>(`/budgets/${id}/status`),

  delete: (id: string) =>
    api.delete(`/budgets/${id}`),

  copy: (fromYear: number, fromMonth: number, toYear: number, toMonth: number) =>
    api.post<{ created: number; budgets: Budget[] }>('/budgets/copy', { fromYear, fromMonth, toYear, toMonth }),

  listPending: (budgetId: string) =>
    api.get<PendingSpend[]>(`/budgets/${budgetId}/pending`),

  addPending: (budgetId: string, data: CreatePendingSpendDTO) =>
    api.post<PendingSpend>(`/budgets/${budgetId}/pending`, data),

  deletePending: (budgetId: string, itemId: string) =>
    api.delete(`/budgets/${budgetId}/pending/${itemId}`),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  getSummary: (params: { from: string; to: string; groupBy: 'category' | 'day' | 'week' | 'month'; categoryIds?: string[] }) =>
    api.get<ReportSummary>('/reports/summary', { params }),

  getTrend: (params: { from: string; to: string; groupBy: 'day' | 'week' | 'month' }) =>
    api.get<TrendPoint[]>('/reports/trend', { params }),

  exportCSV: (params: { from: string; to: string; categoryIds?: string[] }) =>
    api.get('/reports/export', { params, responseType: 'blob' }),
};

// ─── Income ───────────────────────────────────────────────────────────────────

export const incomeApi = {
  // Multi-entry (new)
  listEntries: (year: number, month: number) =>
    api.get<Income[]>('/income/entries', { params: { year, month } }),

  addEntry: (data: UpsertIncomeDTO) =>
    api.post<Income>('/income/entries', data),

  patchEntry: (id: string, data: { amount?: number; label?: string }) =>
    api.patch<Income>(`/income/entries/${id}`, data),

  deleteEntry: (id: string) =>
    api.delete(`/income/entries/${id}`),

  getBalance: (year: number, month: number) =>
    api.get<BalanceSummary>('/income/balance', { params: { year, month } }),

  // Legacy (kept for any existing callers)
  upsert: (data: UpsertIncomeDTO) =>
    api.put<Income>('/income', data),

  get: (year: number, month: number) =>
    api.get<Income | null>('/income', { params: { year, month } }),
};

export default api;

// ─── Pending Items ────────────────────────────────────────────────────────────

export const pendingItemsApi = {
  list: (year: number, month: number) =>
    api.get<PendingItem[]>('/pending', { params: { year, month } }),

  create: (data: CreatePendingItemDTO) =>
    api.post<PendingItem>('/pending', data),

  delete: (id: string) =>
    api.delete(`/pending/${id}`),

  deliver: (id: string) =>
    api.post<{ expenseId: string }>(`/pending/${id}/deliver`),
};

// ─── Account management ───────────────────────────────────────────────────────

export const accountApi = {
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/password', data),

  deleteAccount: (data: { password: string }) =>
    api.delete('/auth/account', { data }),
};

// ─── Recurring Expenses ───────────────────────────────────────────────────────

export const recurringApi = {
  list: () =>
    api.get<RecurringExpense[]>('/recurring'),

  create: (data: CreateRecurringDTO) =>
    api.post<RecurringExpense>('/recurring', data),

  get: (id: string) =>
    api.get<RecurringExpense>(`/recurring/${id}`),

  update: (id: string, data: UpdateRecurringDTO) =>
    api.patch<RecurringExpense>(`/recurring/${id}`, data),

  delete: (id: string) =>
    api.delete(`/recurring/${id}`),

  toggle: (id: string, isPaused: boolean) =>
    api.post<RecurringExpense>(`/recurring/${id}/toggle`, { isPaused }),
};

// ─── Wallets ──────────────────────────────────────────────────────────────────

export const walletsApi = {
  list: () =>
    api.get<Wallet[]>('/wallets'),

  create: (data: CreateWalletDTO) =>
    api.post<Wallet>('/wallets', data),

  update: (id: string, data: UpdateWalletDTO) =>
    api.patch<Wallet>(`/wallets/${id}`, data),

  delete: (id: string) =>
    api.delete(`/wallets/${id}`),
};

// ─── Recurring Income ─────────────────────────────────────────────────────────

export const recurringIncomeApi = {
  list: () =>
    api.get<RecurringIncome[]>('/recurring-income'),

  create: (data: CreateRecurringIncomeDTO) =>
    api.post<RecurringIncome>('/recurring-income', data),

  get: (id: string) =>
    api.get<RecurringIncome>(`/recurring-income/${id}`),

  update: (id: string, data: UpdateRecurringIncomeDTO) =>
    api.patch<RecurringIncome>(`/recurring-income/${id}`, data),

  delete: (id: string) =>
    api.delete(`/recurring-income/${id}`),

  preview: (params: {
    frequency: string;
    startDate: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    monthOfYear?: number;
    count?: number;
  }) =>
    api.get<{ dates: string[] }>('/recurring-income/preview', { params }),

  process: () =>
    api.post<{ created: number }>('/recurring-income/process'),
};
