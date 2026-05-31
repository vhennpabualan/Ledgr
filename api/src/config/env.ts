import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PORT: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 3001)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid env: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
}

export const env = result.data;