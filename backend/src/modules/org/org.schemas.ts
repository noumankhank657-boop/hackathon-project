import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const organizationSettingsSchema = z.object({
  body: z.object({
    officeStart: z.string().regex(timePattern),
    graceMinutes: z.number().int().min(0).max(180),
    halfDayHours: z.number().positive().max(24),
    weekend: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    radiusMeters: z.number().positive().max(5000),
  }),
});

export const namedEntitySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  }),
});

export const leaveTypeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    yearlyQuota: z.number().int().nonnegative().nullable(),
    isPaid: z.boolean(),
  }),
});

export const holidaySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    date: z.string().date(),
  }),
});

export const createHrUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().trim().min(2).max(100).optional(),
  }),
});

export const userActivationSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const resetUserPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8).max(128),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
