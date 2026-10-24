import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { announcementSchema, auditQuerySchema, notificationIdSchema } from "./comms.schemas.js";
import {
  createAnnouncement,
  getUnreadNotificationCount,
  listAnnouncements,
  listAuditLogs,
  listNotifications,
  markNotificationRead,
} from "./comms.service.js";

const router = Router();

router.get("/announcements", requireAuth, async (_request, response, next) => {
  try {
    response.json(await listAnnouncements());
  } catch (error) {
    next(error);
  }
});

router.post("/announcements", requireAuth, validate(announcementSchema), async (request, response, next) => {
  try {
    response.status(201).json(await createAnnouncement(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", requireAuth, async (request, response, next) => {
  try {
    response.json(await listNotifications(request.auth!));
  } catch (error) {
    next(error);
  }
});

router.get("/notifications/unread-count", requireAuth, async (request, response, next) => {
  try {
    response.json({ count: await getUnreadNotificationCount(request.auth!) });
  } catch (error) {
    next(error);
  }
});

router.post("/notifications/:id/read", requireAuth, validate(notificationIdSchema), async (request, response, next) => {
  try {
    response.json(await markNotificationRead(request.auth!, String(request.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get("/audit-logs", requireAuth, validate(auditQuerySchema), async (request, response, next) => {
  try {
    const parsed = auditQuerySchema.parse({ query: request.query });
    response.json(await listAuditLogs(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

export default router;
