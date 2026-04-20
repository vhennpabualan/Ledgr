import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import UpdatePrompt from './components/UpdatePrompt';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-load all page-level routes — keeps initial bundle lean
const DashboardPage  = lazy(() => import('./pages/DashboardPage'));
const ExpensesPage   = lazy(() => import('./pages/ExpensesPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const BudgetsPage    = lazy(() => import('./pages/BudgetsPage'));
const ReportsPage    = lazy(() => import('./pages/ReportsPage'));
const SettingsPage   = lazy(() => import('./pages/SettingsPage'));
const RecurringPage  = lazy(() => import('./pages/RecurringPage'));
const WalletsPage    = lazy(() => import('./pages/WalletsPage'));

// Minimal page skeleton shown during lazy-load
function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-40 rounded-2xl bg-black/[0.05] dark:bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-black/[0.05] dark:bg-white/[0.05]" />
        <div className="h-24 rounded-2xl bg-black/[0.05] dark:bg-white/[0.05]" />
      </div>
      <div className="h-48 rounded-2xl bg-black/[0.05] dark:bg-white/[0.05]" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Data stays fresh for 3 minutes — no refetch on navigation within this window
      staleTime: 3 * 60 * 1000,
      // Keep unused cache for 15 minutes — instant back-navigation
      gcTime: 15 * 60 * 1000,
      // Don't re-fetch when window regains focus
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect unless data is stale
      refetchOnReconnect: 'always',
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense>} />
                  <Route path="/expenses" element={<Suspense fallback={<PageSkeleton />}><ExpensesPage /></Suspense>} />
                  <Route path="/budgets" element={<Suspense fallback={<PageSkeleton />}><BudgetsPage /></Suspense>} />
                  <Route path="/reports" element={<Suspense fallback={<PageSkeleton />}><ReportsPage /></Suspense>} />
                  <Route path="/categories" element={<Suspense fallback={<PageSkeleton />}><CategoriesPage /></Suspense>} />
                  <Route path="/recurring" element={<Suspense fallback={<PageSkeleton />}><RecurringPage /></Suspense>} />
                  <Route path="/settings" element={<Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense>} />
                  <Route path="/wallets" element={<Suspense fallback={<PageSkeleton />}><WalletsPage /></Suspense>} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <UpdatePrompt />
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
