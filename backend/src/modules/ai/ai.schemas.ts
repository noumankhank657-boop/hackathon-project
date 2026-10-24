import { z } from "zod";

export const aiChatSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1).max(3000),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    departmentId: z.string().uuid().optional(),
  }),
});

export const aiSummarizeSchema = z.object({
  body: z.object({
    kpis: z.record(z.any()),
    context: z.string().trim().min(1).max(500).optional(),
  }),
});

export const smartLeaveSchema = z.object({
  body: z.object({
    text: z.string().trim().min(3).max(1000),
  }),
});
