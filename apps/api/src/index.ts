import './config/env';
import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { devRateLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { expenseRouter } from './routes/expense.routes.js';
import { budgetRouter } from './routes/budget.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { incomeRouter } from './routes/income.routes.js';
import { pendingItemsRouter } from './routes/pendingItems.routes.js';
import { recurringRouter } from './routes/recurring.routes.js';
import { walletRouter } from './routes/wallet.routes.js';
import { recurringIncomeRouter } from './routes/recurringIncome.routes.js';
import { pool } from './db/client.js';

const app = express();
const PORT = env.PORT;

app.use(express.json());
app.use(cookieParser());
app.use(requestId);

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Health check with DB connectivity
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error('Health check failed', err);
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

// Apply general API rate limiting to all routes (disabled in dev)
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

// Graceful shutdown handler
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

// Only skip listen in Vercel serverless environment
if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    logger.info(`API running on port ${PORT}`, { nodeEnv: env.NODE_ENV });
  });
}

export default app;