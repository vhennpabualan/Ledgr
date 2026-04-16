import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CreateCategorySchema } from '@ledgr/types';
import {
  listCategories,
  createCategory,
  archiveCategory,
  updateCategory,
  deleteCategory,
} from '../services/category.service.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Extend the partial schema to accept isArchived for the archive action
const PatchCategorySchema = CreateCategorySchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const categoryRouter = Router();

// All category routes require authentication
categoryRouter.use(requireAuth);

// GET /categories — list user-owned + system-default categories
categoryRouter.get('/', async (req: Request, res: Response) => {
  const categories = await listCategories(req.userId!);
  res.json(categories);
});

// POST /categories — create a new user-owned category
categoryRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateCategorySchema.parse(req.body);
  const category = await createCategory(req.userId!, body);
  res.status(201).json(category);
});

// PATCH /categories/:id — archive or update a category
categoryRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = PatchCategorySchema.parse(req.body);

  const category =
    body.isArchived === true
      ? await archiveCategory(id, req.userId!)
      : await updateCategory(id, req.userId!, body);

  res.json(category);
});

// DELETE /categories/:id — hard-delete a user-owned category (403 for system categories)
categoryRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteCategory(req.params.id, req.userId!);
  res.status(204).send();
});
