import { z } from "zod";

export const payrollDraftSchema = z.object({
  body: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(3000),
  }),
});

export const payrollRunIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const payrollListQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
});

export const payslipIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
