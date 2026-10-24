import { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";
import { computeFinalStatus, computeInitialStatus } from "./attendance.engine.js";

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function getOrgSettings() {
  const row = await db.setting.findUnique({ where: { key: "organization" } });
  return (row?.value as
    | {
        officeStart?: string;
        graceMinutes?: number;
        halfDayHours?: number;
      }
    | null) ?? { officeStart: "09:00", graceMinutes: 15, halfDayHours: 5 };
}

function requireEmployee(auth: TokenPayload) {
  if (auth.role !== "EMPLOYEE" || !auth.employeeId) throw new AppError(403, "Only employees can perform this action");
  return auth.employeeId;
}

export async function checkIn(
  auth: TokenPayload,
  payload: { source?: "WEB" | "CAMERA" | "CORRECTION"; lat?: number; lng?: number; accuracy?: number },
) {
  const employeeId = requireEmployee(auth);
  const now = new Date();
  const { start, end } = dayRange(now);
  const existing = await db.attendance.findFirst({ where: { employeeId, date: { gte: start, lt: end } } });
  if (existing) throw new AppError(409, "You have already checked in today");

  const settings = await getOrgSettings();
  const status = computeInitialStatus(now, settings.officeStart ?? "09:00", settings.graceMinutes ?? 15);
  const record = await db.attendance.create({
    data: {
      employeeId,
      date: start,
      checkIn: now,
      status,
      source: payload.source ?? "WEB",
      lat: payload.lat,
      lng: payload.lng,
      accuracy: payload.accuracy,
    },
  });
  await audit(auth.userId, "CREATE", "ATTENDANCE", record.id, null, record as unknown as Prisma.JsonObject);
  return record;
}

export async function checkOut(auth: TokenPayload, payload: { source?: "WEB" | "CAMERA" | "CORRECTION"; lat?: number; lng?: number; accuracy?: number }) {
  const employeeId = requireEmployee(auth);
  const now = new Date();
  const { start, end } = dayRange(now);
  const attendance = await db.attendance.findFirst({ where: { employeeId, date: { gte: start, lt: end } } });
  if (!attendance) throw new AppError(422, "You must check in before checking out");
  if (attendance.checkOut) throw new AppError(409, "You have already checked out today");
  if (!attendance.checkIn) throw new AppError(422, "Check-in record is incomplete");

  const settings = await getOrgSettings();
  const finalStatus = computeFinalStatus({
    checkIn: attendance.checkIn,
    checkOut: now,
    initialStatus: attendance.status,
    halfDayHours: settings.halfDayHours ?? 5,
  });

  const updated = await db.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: now,
      status: finalStatus,
      source: payload.source ?? attendance.source,
      lat: payload.lat ?? attendance.lat,
      lng: payload.lng ?? attendance.lng,
      accuracy: payload.accuracy ?? attendance.accuracy,
    },
  });
  await audit(auth.userId, "UPDATE", "ATTENDANCE", updated.id, attendance as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function getAttendanceCalendar(auth: TokenPayload, query: { employeeId?: string; from: string; to: string }) {
  const requestedEmployeeId = query.employeeId ?? auth.employeeId;
  if (!requestedEmployeeId) throw new AppError(422, "Employee ID is required");
  if (auth.role === "EMPLOYEE" && requestedEmployeeId !== auth.employeeId) throw new AppError(403, "You may only access your own records");
  const from = new Date(query.from);
  const to = new Date(query.to);
  to.setHours(23, 59, 59, 999);
  const attendances = await db.attendance.findMany({
    where: { employeeId: requestedEmployeeId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  const approvedLeaves = await db.leaveRequest.findMany({
    where: {
      employeeId: requestedEmployeeId,
      status: "APPROVED",
      startDate: { lte: to },
      endDate: { gte: from },
    },
    select: { startDate: true, endDate: true },
  });
  const attendanceMap = new Map(attendances.map((item) => [item.date.toISOString().slice(0, 10), item]));
  const rows = [...attendances];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    if (!attendanceMap.has(key)) {
      const onLeave = approvedLeaves.some((leave) => cursor >= leave.startDate && cursor <= leave.endDate);
      if (onLeave) {
        rows.push({
          id: `virtual-on-leave-${key}`,
          employeeId: requestedEmployeeId,
          date: new Date(cursor),
          checkIn: null,
          checkOut: null,
          status: "ON_LEAVE",
          source: "WEB",
          lat: null,
          lng: null,
          accuracy: null,
          faceMatchScore: null,
          createdAt: new Date(cursor),
          updatedAt: new Date(cursor),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function getDailyBoard(auth: TokenPayload, date: string) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can access this board");
  const day = new Date(date);
  const { start, end } = dayRange(day);
  return db.attendance.findMany({
    where: { date: { gte: start, lt: end } },
    include: {
      employee: {
        include: { user: { select: { email: true } }, department: true, designation: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function requestAttendanceCorrection(
  auth: TokenPayload,
  payload: { date: string; checkIn?: string; checkOut?: string; reason: string },
) {
  const employeeId = requireEmployee(auth);
  const date = new Date(payload.date);
  date.setHours(0, 0, 0, 0);
  const attendance = await db.attendance.findFirst({
    where: {
      employeeId,
      date: {
        gte: date,
        lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
  const existingPending = await db.attendanceCorrection.findFirst({
    where: { employeeId, date, status: "PENDING" },
  });
  if (existingPending) throw new AppError(409, "A pending correction already exists for this date");
  const correction = await db.attendanceCorrection.create({
    data: {
      employeeId,
      attendanceId: attendance?.id,
      date,
      checkIn: payload.checkIn ? new Date(payload.checkIn) : null,
      checkOut: payload.checkOut ? new Date(payload.checkOut) : null,
      reason: payload.reason,
    },
  });
  await audit(auth.userId, "CREATE", "ATTENDANCE_CORRECTION", correction.id, null, correction as unknown as Prisma.JsonObject);
  return correction;
}

export async function listCorrections(auth: TokenPayload, status?: "PENDING" | "APPROVED" | "REJECTED") {
  const where: Prisma.AttendanceCorrectionWhereInput = status ? { status } : {};
  if (auth.role === "EMPLOYEE") where.employeeId = auth.employeeId;
  return db.attendanceCorrection.findMany({
    where,
    include: { employee: { include: { user: { select: { email: true } } } }, attendance: true },
    orderBy: { createdAt: "desc" },
  });
}

async function applyCorrection(
  correction: Awaited<ReturnType<typeof db.attendanceCorrection.findUniqueOrThrow>>,
  checkIn?: Date,
  checkOut?: Date,
) {
  const attendanceDate = correction.date;
  const attendance = correction.attendanceId
    ? await db.attendance.findUnique({ where: { id: correction.attendanceId } })
    : await db.attendance.findFirst({
        where: {
          employeeId: correction.employeeId,
          date: { gte: attendanceDate, lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000) },
        },
      });
  const settings = await getOrgSettings();
  const computedStatus = checkIn
    ? checkOut
      ? computeFinalStatus({
          checkIn,
          checkOut,
          initialStatus: computeInitialStatus(checkIn, settings.officeStart ?? "09:00", settings.graceMinutes ?? 15),
          halfDayHours: settings.halfDayHours ?? 5,
        })
      : computeInitialStatus(checkIn, settings.officeStart ?? "09:00", settings.graceMinutes ?? 15)
    : "MISSING_CHECKOUT";

  if (attendance) {
    return db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkIn: checkIn ?? attendance.checkIn,
        checkOut: checkOut ?? attendance.checkOut,
        status: computedStatus,
        source: "CORRECTION",
      },
    });
  }

  return db.attendance.create({
    data: {
      employeeId: correction.employeeId,
      date: attendanceDate,
      checkIn: checkIn ?? null,
      checkOut: checkOut ?? null,
      status: computedStatus,
      source: "CORRECTION",
    },
  });
}

export async function approveCorrection(
  auth: TokenPayload,
  id: string,
  payload: { comment?: string; checkIn?: string; checkOut?: string },
) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can approve corrections");
  const before = await db.attendanceCorrection.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Correction not found");
  if (before.status !== "PENDING") throw new AppError(422, "Only pending corrections can be approved");
  const checkIn = payload.checkIn ? new Date(payload.checkIn) : before.checkIn ?? undefined;
  const checkOut = payload.checkOut ? new Date(payload.checkOut) : before.checkOut ?? undefined;
  const updatedAttendance = await applyCorrection(before, checkIn, checkOut);
  const updated = await db.attendanceCorrection.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: auth.userId,
      approvedAt: new Date(),
      comment: payload.comment,
      attendanceId: updatedAttendance.id,
      checkIn: checkIn ?? null,
      checkOut: checkOut ?? null,
    },
  });
  await audit(auth.userId, "APPROVE", "ATTENDANCE_CORRECTION", id, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function rejectCorrection(auth: TokenPayload, id: string, comment?: string) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can reject corrections");
  const before = await db.attendanceCorrection.findUnique({ where: { id } });
  if (!before) throw new AppError(404, "Correction not found");
  if (before.status !== "PENDING") throw new AppError(422, "Only pending corrections can be rejected");
  const updated = await db.attendanceCorrection.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: auth.userId,
      approvedAt: new Date(),
      comment,
    },
  });
  await audit(auth.userId, "REJECT", "ATTENDANCE_CORRECTION", id, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}
