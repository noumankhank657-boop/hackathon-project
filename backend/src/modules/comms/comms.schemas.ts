import { z } from "zod";

export const announcementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(150),
    body: z.string().trim().min(5).max(2000),
  }),
});

export const auditQuerySchema = z.object({
  query: z.object({
    actorId: z.string().uuid().optional(),
    action: z.string().trim().optional(),
    entity: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
