import { z } from "zod";

const sourceEnum = z.enum(["WEB", "CAMERA", "CORRECTION"]).default("WEB");

export const checkInSchema = z.object({
  body: z.object({
    source: sourceEnum.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    accuracy: z.number().positive().optional(),
    faceCount: z.number().int().min(0).optional(),
    faceDescriptor: z.array(z.number()).length(128).optional(),
    blinkVerified: z.boolean().optional(),
  }),
});

export const checkOutSchema = z.object({
  body: z.object({
    source: sourceEnum.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    accuracy: z.number().positive().optional(),
  }),
});

export const calendarQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid().optional(),
    from: z.string().date(),
    to: z.string().date(),
  }),
});

export const boardQuerySchema = z.object({
  query: z.object({
    date: z.string().date(),
  }),
});

export const correctionSchema = z.object({
  body: z.object({
    date: z.string().date(),
    checkIn: z.string().datetime().optional(),
    checkOut: z.string().datetime().optional(),
    reason: z.string().trim().min(5).max(500),
  }),
});

export const correctionDecisionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    comment: z.string().trim().max(500).optional(),
    checkIn: z.string().datetime().optional(),
    checkOut: z.string().datetime().optional(),
  }),
});

export const correctionListQuerySchema = z.object({
  query: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  }),
});
