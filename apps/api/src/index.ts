import './config/env'; // validate env vars before anything else
import 'express-async-errors'; // catch async errors in routes
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { expenseRouter } from './routes/expense.routes.js';
import { budgetRouter } from './routes/budget.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { incomeRouter } from './routes/income.routes.js';
import { pendingItemsRouter } from './routes/pendingItems.routes.js';

const app = express();
const PORT = env.PORT;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(cookieParser());

// In dev, CORS is needed because web runs on a different port.
// In prod, web is served by the same Express process — no CORS needed for the browser,
// but we still allow it for external API consumers.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({ origin: isProd ? true : allowedOrigins, credentials: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── API routes — prefixed with /api ──────────────────────────────────────────
// Dev proxy in vite.config.ts strips /api before forwarding, so locally the
// routes are hit without the prefix. In production they're served directly.
app.use('/api/auth',       authRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/expenses',   expenseRouter);
app.use('/api/budgets',    budgetRouter);
app.use('/api/reports',    reportRouter);
app.use('/api/income',     incomeRouter);
app.use('/api/pending',    pendingItemsRouter);

// ── Serve React SPA in production ────────────────────────────────────────────
if (isProd) {
  const staticDir = path.join(__dirname, '..', 'public');
  app.use(express.static(staticDir));
  // SPA fallback — any non-API route serves index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// Global error handler — must be registered after all routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
