import { z } from "zod";

export const applyLeaveSchema = z.object({
  body: z.object({
    leaveTypeId: z.string().uuid(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    reason: z.string().trim().min(5).max(500),
  }),
});

export const leaveDecisionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    comment: z.string().trim().min(1).max(500),
  }),
});

export const leaveCancelSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const leaveListSchema = z.object({
  query: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
    employeeId: z.string().uuid().optional(),
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
});

export const employeeIdSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  query: z.object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
});
