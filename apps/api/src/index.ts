import './config/env';
import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
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

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth',       authRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/expenses',   expenseRouter);
app.use('/api/budgets',    budgetRouter);
app.use('/api/reports',    reportRouter);
app.use('/api/income',     incomeRouter);
app.use('/api/pending',    pendingItemsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
}
export default app;