import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_FUTURE_DAYS = 7;

function isDateWithinFutureLimit(dateStr: string): boolean {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return false;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + MAX_FUTURE_DAYS);
  // Compare date-only (strip time component)
  maxDate.setHours(23, 59, 59, 999);
  return parsed <= maxDate;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const CreateExpenseSchema = z.object({
  /** Positive integer in minor currency units; max 99,999,999 */
  amount: z.number().int().positive().max(99999999),
  /** ISO 4217 currency code, e.g. "PHP" */
  currency: z.string().regex(/^[A-Z]{3}$/, "Must be a valid ISO 4217 currency code"),
  /** ISO 8601 date string; must not be more than 7 days in the future */
  date: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: "Must be a valid date" })
    .refine(isDateWithinFutureLimit, {
      message: "Date must not be more than 7 days in the future",
    }),
  categoryId: z.string().uuid(),
  description: z.string().max(500).optional(),
  receiptUrl: z.string().url().optional(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const UpdateExpenseSchema = CreateExpenseSchema.partial().extend({
  // Allow null to explicitly clear the receipt URL
  receiptUrl: z.string().url().nullable().optional(),
});

export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const CreateBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  /** Positive integer in minor currency units */
  limitAmount: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Must be a valid ISO 4217 currency code"),
  year: z.number().int().min(2000),
  /** 1–12 */
  month: z.number().int().min(1).max(12),
  rollover: z.boolean(),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  /** Trimmed, 1–50 chars */
  name: z.string().trim().min(1).max(50),
  /** Emoji or icon identifier */
  icon: z.string().min(1),
  /** Hex color, e.g. "#FF5733" */
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  parentId: z.string().uuid().optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const ExpenseFiltersSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  minAmount: z.number().int().positive().optional(),
  maxAmount: z.number().int().positive().optional(),
  page: z.number().int().min(1).default(1),
  /** Max 100 per page */
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type ExpenseFiltersInput = z.infer<typeof ExpenseFiltersSchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;
