import bcrypt from "bcrypt";
import type { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../middleware/error-handler.js";

type OrganizationSettings = {
  officeStart: string;
  graceMinutes: number;
  halfDayHours: number;
  weekend: number[];
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
};

const DEFAULT_SETTINGS: OrganizationSettings = {
  officeStart: "09:00",
  graceMinutes: 15,
  halfDayHours: 5,
  weekend: [0, 6],
  latitude: null,
  longitude: null,
  radiusMeters: 150,
};

const DEFAULT_LEAVE_TYPES = [
  { name: "Annual", yearlyQuota: 14, isPaid: true },
  { name: "Sick", yearlyQuota: 8, isPaid: true },
  { name: "Casual", yearlyQuota: 10, isPaid: true },
  { name: "Unpaid", yearlyQuota: null, isPaid: false },
] as const;

export async function getOrganizationSettings() {
  const row = await db.setting.findUnique({ where: { key: "organization" } });
  return (row?.value as OrganizationSettings | null) ?? DEFAULT_SETTINGS;
}

export async function upsertOrganizationSettings(actorId: string, payload: OrganizationSettings) {
  const before = await db.setting.findUnique({ where: { key: "organization" } });
  const record = await db.setting.upsert({
    where: { key: "organization" },
    create: { key: "organization", value: payload },
    update: { value: payload },
  });
  await audit(actorId, "UPDATE", "SETTING", record.id, before?.value as Prisma.JsonObject | undefined, payload as Prisma.JsonObject);
  return record.value;
}

export async function listNamedEntities(type: "department" | "designation") {
  if (type === "department") {
    return db.department.findMany({ orderBy: { name: "asc" } });
  }
  return db.designation.findMany({ orderBy: { name: "asc" } });
}

export async function createNamedEntity(actorId: string, type: "department" | "designation", payload: { name: string; description?: string }) {
  const created =
    type === "department"
      ? await db.department.create({ data: payload })
      : await db.designation.create({ data: payload });
  await audit(actorId, "CREATE", type.toUpperCase(), created.id, null, created as unknown as Prisma.JsonObject);
  return created;
}

export async function updateNamedEntity(actorId: string, type: "department" | "designation", id: string, payload: { name: string; description?: string }) {
  const before =
    type === "department"
      ? await db.department.findUnique({ where: { id } })
      : await db.designation.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Record not found");
  const updated =
    type === "department"
      ? await db.department.update({ where: { id }, data: payload })
      : await db.designation.update({ where: { id }, data: payload });
  await audit(actorId, "UPDATE", type.toUpperCase(), id, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function deleteNamedEntity(actorId: string, type: "department" | "designation", id: string) {
  const before =
    type === "department"
      ? await db.department.findUnique({ where: { id } })
      : await db.designation.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Record not found");
  if (type === "department") {
    await db.department.delete({ where: { id } });
  } else {
    await db.designation.delete({ where: { id } });
  }
  await audit(actorId, "DELETE", type.toUpperCase(), id, before as unknown as Prisma.JsonObject, null);
}

export async function ensureDefaultLeaveTypes(actorId: string) {
  for (const leaveType of DEFAULT_LEAVE_TYPES) {
    const existing = await db.leaveType.findUnique({ where: { name: leaveType.name } });
    if (!existing) {
      const created = await db.leaveType.create({ data: leaveType });
      await audit(actorId, "CREATE", "LEAVE_TYPE", created.id, null, created as unknown as Prisma.JsonObject);
    }
  }
}

export async function listLeaveTypes() {
  return db.leaveType.findMany({ orderBy: { name: "asc" } });
}

export async function createLeaveType(actorId: string, payload: { name: string; yearlyQuota: number | null; isPaid: boolean }) {
  const created = await db.leaveType.create({ data: payload });
  await audit(actorId, "CREATE", "LEAVE_TYPE", created.id, null, created as unknown as Prisma.JsonObject);
  return created;
}

export async function updateLeaveType(
  actorId: string,
  id: string,
  payload: { name: string; yearlyQuota: number | null; isPaid: boolean },
) {
  const before = await db.leaveType.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Leave type not found");
  const updated = await db.leaveType.update({ where: { id }, data: payload });
  await audit(actorId, "UPDATE", "LEAVE_TYPE", id, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function deleteLeaveType(actorId: string, id: string) {
  const before = await db.leaveType.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Leave type not found");
  await db.leaveType.delete({ where: { id } });
  await audit(actorId, "DELETE", "LEAVE_TYPE", id, before as unknown as Prisma.JsonObject, null);
}

export async function listHolidays() {
  return db.holiday.findMany({ orderBy: { date: "asc" } });
}

export async function createHoliday(actorId: string, payload: { name: string; date: string }) {
  const created = await db.holiday.create({ data: { name: payload.name, date: new Date(payload.date) } });
  await audit(actorId, "CREATE", "HOLIDAY", created.id, null, created as unknown as Prisma.JsonObject);
  return created;
}

export async function updateHoliday(actorId: string, id: string, payload: { name: string; date: string }) {
  const before = await db.holiday.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Holiday not found");
  const updated = await db.holiday.update({ where: { id }, data: { name: payload.name, date: new Date(payload.date) } });
  await audit(actorId, "UPDATE", "HOLIDAY", id, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function deleteHoliday(actorId: string, id: string) {
  const before = await db.holiday.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Holiday not found");
  await db.holiday.delete({ where: { id } });
  await audit(actorId, "DELETE", "HOLIDAY", id, before as unknown as Prisma.JsonObject, null);
}

export async function createHrLogin(actorId: string, payload: { email: string; password: string; name?: string }) {
  const created = await db.user.create({
    data: {
      email: payload.email.toLowerCase(),
      name: payload.name?.trim() || null,
      passwordHash: await bcrypt.hash(payload.password, 12),
      role: "HR",
      mustChangePassword: true,
    },
    select: { id: true, email: true, role: true, name: true },
  });
  await audit(actorId, "CREATE", "USER", created.id, null, created as unknown as Prisma.JsonObject);
  return created;
}

export async function setUserActive(actorId: string, id: string, isActive: boolean) {
  const before = await db.user.findUnique({ where: { id }, select: { id: true, isActive: true, email: true, role: true } });
  if (!before) throw new AppError(404, "User not found");
  const updated = await db.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true, email: true, role: true },
  });
  await audit(actorId, "UPDATE", "USER", id, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function resetUserPassword(actorId: string, id: string, password: string) {
  const before = await db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
  if (!before) throw new AppError(404, "User not found");
  await db.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true },
  });
  await audit(actorId, "RESET_PASSWORD", "USER", id, before as unknown as Prisma.JsonObject, { mustChangePassword: true } as Prisma.JsonObject);
}

export async function listHrUsers() {
  return db.user.findMany({
    where: { role: "HR" },
    select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
