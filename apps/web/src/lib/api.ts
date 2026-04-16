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
          '/auth/refresh',
          {},
          {
            baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
            withCredentials: true,
          },
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
  create: (data: CreateExpenseDTO) =>
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
  upsert: (data: UpsertIncomeDTO) =>
    api.put<Income>('/income', data),

  get: (year: number, month: number) =>
    api.get<Income | null>('/income', { params: { year, month } }),

  getBalance: (year: number, month: number) =>
    api.get<BalanceSummary>('/income/balance', { params: { year, month } }),
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
