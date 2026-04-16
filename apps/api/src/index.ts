import './config/env'; // validate env vars before anything else
import 'express-async-errors'; // catch async errors in routes
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './config/env';
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

app.use('/auth', authRouter);
app.use('/categories', categoryRouter);
app.use('/expenses', expenseRouter);
app.use('/budgets', budgetRouter);
app.use('/reports', reportRouter);
app.use('/income', incomeRouter);
app.use('/pending', pendingItemsRouter);

// Global error handler — must be registered after all routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

export default app;
