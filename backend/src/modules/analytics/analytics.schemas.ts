import { z } from "zod";

export const analyticsQuerySchema = z.object({
  query: z.object({
    from: z.string().date(),
    to: z.string().date(),
    departmentId: z.string().uuid().optional(),
  }),
});
