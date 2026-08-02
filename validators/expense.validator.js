import { z } from 'zod';
import { EXPENSE_SOURCES } from '../models/expense.model.js';

const isoDateTime = z.string().datetime({ offset: true });

const localDate = z
  .string({ required_error: 'localDate is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'localDate must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'localDate must be a real calendar date');

export const syncExpenseSchema = z
  .object({
    clientId: z
      .string({ required_error: 'clientId is required' })
      .trim()
      .min(1, 'clientId is required')
      .max(128, 'clientId is too long')
      .regex(/^[A-Za-z0-9._:-]+$/, 'clientId contains unsupported characters'),
    tileId: z.string().trim().min(1).max(128).nullable().optional(),
    categorySlug: z
      .string({ required_error: 'categorySlug is required' })
      .trim()
      .toLowerCase()
      .min(1, 'categorySlug is required')
      .max(50)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'categorySlug is invalid'),
    name: z
      .string({ required_error: 'name is required' })
      .trim()
      .min(1, 'name is required')
      .max(80, 'Keep the name under 80 characters'),
    note: z.string().trim().max(280).optional(),
    merchant: z.string().trim().max(80).optional(),
    unitAmountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    quantity: z.number().int().nonnegative().max(1_000_000),
    occurredAt: isoDateTime,
    localDate,
    source: z.enum(EXPENSE_SOURCES),
    deletedAt: isoDateTime.nullable().optional().default(null),
  })
  .strict()
  .superRefine((expense, ctx) => {
    if (!Number.isSafeInteger(expense.unitAmountMinor * expense.quantity)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Amount multiplied by quantity is too large',
      });
    }
  });

export const syncExpensesSchema = z
  .object({
    expenses: z
      .array(syncExpenseSchema, { required_error: 'expenses is required' })
      .min(1, 'Send at least one expense')
      .max(500, 'A sync batch can contain at most 500 expenses'),
  })
  .strict()
  .superRefine(({ expenses }, ctx) => {
    const seen = new Set();
    expenses.forEach((expense, index) => {
      if (seen.has(expense.clientId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expenses', index, 'clientId'],
          message: 'clientId must be unique within a sync batch',
        });
      }
      seen.add(expense.clientId);
    });
  });

export default syncExpensesSchema;
