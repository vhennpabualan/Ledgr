import './src/config/env';
import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './src/config/env';
import { logger } from './src/lib/logger';
import { errorHandler } from './src/middleware/errorHandler';
import { requestId } from './src/middleware/requestId';
import { devRateLimit } from './src/middleware/rateLimit';
import { authRouter } from './src/routes/auth.routes';
import { categoryRouter } from './src/routes/category.routes';
import { expenseRouter } from './src/routes/expense.routes';
import { budgetRouter } from './src/routes/budget.routes';
import { reportRouter } from './src/routes/report.routes';
import { incomeRouter } from './src/routes/income.routes';
import { pendingItemsRouter } from './src/routes/pendingItems.routes';
import { recurringRouter } from './src/routes/recurring.routes';
import { walletRouter } from './src/routes/wallet.routes';
import { recurringIncomeRouter } from './src/routes/recurringIncome.routes';
import { pool } from './src/db/client';

const app = express();
const PORT = env.PORT;

app.use(express.json());
app.use(cookieParser());
app.use(requestId);

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Health endpoint — exposed at /health (local dev) and /api/health (Vercel /api rewrite).
// Deliberately kept outside the /api rate limiter and auth so it's always reachable.
const healthHandler: express.RequestHandler = async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error('Health check failed', err);
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use('/api', devRateLimit);

app.use('/api/auth',       authRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/expenses',   expenseRouter);
app.use('/api/budgets',    budgetRouter);
app.use('/api/reports',    reportRouter);
app.use('/api/income',     incomeRouter);
app.use('/api/pending',    pendingItemsRouter);
app.use('/api/recurring',  recurringRouter);
app.use('/api/wallets',    walletRouter);
app.use('/api/recurring-income', recurringIncomeRouter);

// JSON 404 for unmatched /api/* paths — makes routing issues visible instead of HTML 404s
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'NOT_FOUND', path: req.originalUrl });
    return;
  }
  res.status(404).send('Not found');
});

app.use(errorHandler);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info(`API running on port ${PORT}`, { nodeEnv: env.NODE_ENV });
  });
}

// Vercel: zero-config Node function at /api via a default-exported Express app.
export default app;