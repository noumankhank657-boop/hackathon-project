import { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";

export async function listAnnouncements() {
  return db.announcement.findMany({
    include: { author: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAnnouncement(auth: TokenPayload, payload: { title: string; body: string }) {
  if (!["ADMIN", "HR"].includes(auth.role)) throw new AppError(403, "Only Admin and HR can post announcements");
  const created = await db.announcement.create({
    data: { title: payload.title, body: payload.body, authorId: auth.userId },
  });
  await audit(auth.userId, "CREATE", "ANNOUNCEMENT", created.id, null, created as unknown as Prisma.JsonObject);
  return created;
}

export async function listNotifications(auth: TokenPayload) {
  return db.notification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function markNotificationRead(auth: TokenPayload, id: string) {
  const before = await db.notification.findUnique({ where: { id } });
  if (!before || before.userId !== auth.userId) throw new AppError(404, "Notification not found");
  return db.notification.update({ where: { id }, data: { isRead: true } });
}

export async function getUnreadNotificationCount(auth: TokenPayload) {
  return db.notification.count({ where: { userId: auth.userId, isRead: false } });
}

export async function listAuditLogs(
  auth: TokenPayload,
  query: { actorId?: string; action?: string; entity?: string; page: number; pageSize: number },
) {
  if (auth.role !== "ADMIN") throw new AppError(403, "Only Admin can access audit logs");
  const where: Prisma.AuditLogWhereInput = {
    actorId: query.actorId,
    action: query.action,
    entity: query.entity,
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, page: query.page, pageSize: query.pageSize, rows };
}
