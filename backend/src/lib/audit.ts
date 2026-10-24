import { db } from "./db.js";

export const audit = (actorId: string | undefined, action: string, entity: string, entityId?: string, before?: object | null, after?: object | null) =>
  db.auditLog.create({ data: { actorId, action, entity, entityId, before: before ?? undefined, after: after ?? undefined } });
