import './src/config/env.js';
import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import serverless from 'serverless-http';
import { env } from './src/config/env.js';
import { logger } from './src/lib/logger.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { requestId } from './src/middleware/requestId.js';
import { devRateLimit } from './src/middleware/rateLimit.js';
import { authRouter } from './src/routes/auth.routes.js';
import { categoryRouter } from './src/routes/category.routes.js';
import { expenseRouter } from './src/routes/expense.routes.js';
import { budgetRouter } from './src/routes/budget.routes.js';
import { reportRouter } from './src/routes/report.routes.js';
import { incomeRouter } from './src/routes/income.routes.js';
import { pendingItemsRouter } from './src/routes/pendingItems.routes.js';
import { recurringRouter } from './src/routes/recurring.routes.js';
import { walletRouter } from './src/routes/wallet.routes.js';
import { recurringIncomeRouter } from './src/routes/recurringIncome.routes.js';
import { pool } from './src/db/client.js';

const app = express();
const PORT = env.PORT;

app.use(express.json());
app.use(cookieParser());
app.use(requestId);

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error('Health check failed', err);
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

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

app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (err) {
    logger.error('Error closing database pool', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    logger.info(`API running on port ${PORT}`, { nodeEnv: env.NODE_ENV });
  });
}

export const handler = serverless(app);