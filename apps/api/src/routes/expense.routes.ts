import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseFiltersSchema,
} from '@ledgr/types';
import {
  createExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
} from '../services/expense.service.js';
import { generatePresignedUploadUrl, deleteReceiptByUrl } from '../services/storage.service.js';
import { scanReceipt } from '../services/receiptScan.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const expenseRouter = Router();
expenseRouter.use(requireAuth);

// Multer — memory storage, 10 MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are supported for receipt scanning.'));
  },
});

// ─── Static routes (must come before /:id) ───────────────────────────────────

// Validation schema for scan-receipt
const ScanReceiptSchema = z.object({
  // File is validated by multer, no body fields needed
});

// POST /expenses/scan-receipt — scan an image and extract expense data via Gemini
expenseRouter.post(
  '/scan-receipt',
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    if (!env.GEMINI_API_KEY) {
      res.status(503).json({ message: 'Receipt scanning is not configured on this server.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'No image file provided.' });
      return;
    }
    
    // Validate file type more strictly
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({ message: 'Unsupported image format. Use JPEG, PNG, WebP, or GIF.' });
      return;
    }
    
    try {
      const result = await scanReceipt(req.file.buffer, req.file.mimetype);
      if (!result) {
        res.status(503).json({ message: 'Receipt scanning unavailable.' });
        return;
      }
      logger.debug('Receipt scanned', { requestId: req.requestId, confidence: result.confidence });
      res.json(result);
    } catch (err) {
      logger.error('Receipt scan failed', err, { requestId: req.requestId });
      res.status(500).json({ message: 'Failed to scan receipt.' });
    }
  },
);

// POST /expenses — create a new expense
expenseRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateExpenseSchema.parse(req.body);
  const walletId = typeof req.body.walletId === 'string' ? req.body.walletId : undefined;
  const expense = await createExpense(req.userId!, body, undefined, walletId);
  res.status(201).json(expense);
});

// GET /expenses — list expenses with optional filters
expenseRouter.get('/', async (req: Request, res: Response) => {
  // Validate categoryIds as UUID array if present
  let categoryIds: string[] | undefined;
  if (req.query.categoryIds) {
    const raw = Array.isArray(req.query.categoryIds) 
      ? req.query.categoryIds 
      : [req.query.categoryIds];
    
    // Validate each is a valid UUID
    const uuidSchema = z.string().uuid();
    const validated: string[] = [];
    for (const id of raw) {
      if (typeof id === 'string') {
        const result = uuidSchema.safeParse(id);
        if (result.success) validated.push(id);
      }
    }
    categoryIds = validated.length > 0 ? validated : undefined;
  }
  
  const raw = {
    from: req.query.from,
    to: req.query.to,
    categoryIds,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
    maxAmount: req.query.maxAmount ? Number(req.query.maxAmount) : undefined,
  };
  const filters = ExpenseFiltersSchema.parse(raw);
  const result = await listExpenses(req.userId!, filters);
  res.json(result);
});

// ─── Parameterised routes ─────────────────────────────────────────────────────

// GET /expenses/:id
expenseRouter.get('/:id', async (req: Request, res: Response) => {
  const expense = await getExpense(req.params.id, req.userId!);
  res.json(expense);
});

// PATCH /expenses/:id
expenseRouter.patch('/:id', async (req: Request, res: Response) => {
  const body = UpdateExpenseSchema.parse(req.body);
  const expense = await updateExpense(req.params.id, req.userId!, body);
  res.json(expense);
});

// DELETE /expenses/:id
expenseRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteExpense(req.params.id, req.userId!);
  res.status(204).send();
});

const ReceiptUrlBodySchema = z.object({
  filename: z.string().min(1).max(255),
});

// POST /expenses/:id/receipt-url — generate a pre-signed R2 upload URL
expenseRouter.post('/:id/receipt-url', async (req: Request, res: Response) => {
  await getExpense(req.params.id, req.userId!);
  const { filename } = ReceiptUrlBodySchema.parse(req.body);
  const result = await generatePresignedUploadUrl(req.userId!, req.params.id, filename);
  res.json(result);
});

// DELETE /expenses/:id/receipt — remove receipt from R2 and clear receiptUrl
expenseRouter.delete('/:id/receipt', async (req: Request, res: Response) => {
  const expense = await getExpense(req.params.id, req.userId!);

  if (!expense.receiptUrl) {
    res.status(404).json({ message: 'No receipt attached to this expense.' });
    return;
  }

  try {
    await deleteReceiptByUrl(expense.receiptUrl);
    logger.info('Receipt deleted from storage', { 
      requestId: req.requestId, 
      expenseId: expense.id 
    });
  } catch (err) {
    logger.warn('Failed to delete R2 object', { 
      requestId: req.requestId, 
      expenseId: expense.id,
      error: err instanceof Error ? err.message : String(err)
    });
    // Continue anyway — we still want to clear the receiptUrl
  }

  const updated = await updateExpense(req.params.id, req.userId!, { receiptUrl: null });
  res.json(updated);
});
