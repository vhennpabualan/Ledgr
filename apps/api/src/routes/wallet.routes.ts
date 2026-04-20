import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { listWallets, createWallet, updateWallet, deleteWallet } from '../services/wallet.service.js';

const CreateWalletSchema = z.object({
  name: z.string().trim().min(1).max(100),
  balance: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

const UpdateWalletSchema = CreateWalletSchema.partial();

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get('/', async (req: Request, res: Response) => {
  res.json(await listWallets(req.userId!));
});

walletRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateWalletSchema.parse(req.body);
  res.status(201).json(await createWallet(req.userId!, body));
});

walletRouter.patch('/:id', async (req: Request, res: Response) => {
  const body = UpdateWalletSchema.parse(req.body);
  res.json(await updateWallet(req.params.id, req.userId!, body));
});

walletRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteWallet(req.params.id, req.userId!);
  res.status(204).send();
});
