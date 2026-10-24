import { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";
import { computeLeaveBalances, countWorkingDays } from "./leave.rules.js";

async function getWeekendAndHolidays(year: number) {
  const orgSetting = await db.setting.findUnique({ where: { key: "organization" } });
  const weekend = new Set<number>(((orgSetting?.value as { weekend?: number[] } | null)?.weekend ?? [0, 6]).map(Number));
  const holidays = await db.holiday.findMany({
    where: {
      date: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)));
  return { weekend, holidaySet };
}

function requireEmployee(auth: TokenPayload) {
  if (auth.role !== "EMPLOYEE" || !auth.employeeId) throw new AppError(403, "Only employees can perform this action");
  return auth.employeeId;
}

export async function getLeaveBalances(auth: TokenPayload, employeeId: string, year = new Date().getFullYear()) {
  if (auth.role === "EMPLOYEE" && auth.employeeId !== employeeId) throw new AppError(403, "You may only access your own records");
  const leaveTypes = await db.leaveType.findMany({ orderBy: { name: "asc" } });
  const usage = await db.leaveRequest.groupBy({
    by: ["leaveTypeId"],
    where: {
      employeeId,
      status: "APPROVED",
      startDate: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    },
    _sum: { days: true },
  });
  const balances = computeLeaveBalances(
    leaveTypes.map((item) => ({ id: item.id, yearlyQuota: item.yearlyQuota })),
    usage.map((item) => ({ leaveTypeId: item.leaveTypeId, days: Number(item._sum.days ?? 0) })),
  );
  return leaveTypes.map((leaveType) => ({
    leaveTypeId: leaveType.id,
    name: leaveType.name,
    isPaid: leaveType.isPaid,
    quota: leaveType.yearlyQuota,
    used: balances.find((item) => item.leaveTypeId === leaveType.id)?.used ?? 0,
    remaining: balances.find((item) => item.leaveTypeId === leaveType.id)?.remaining ?? leaveType.yearlyQuota,
  }));
}

export async function applyLeave(
  auth: TokenPayload,
  payload: { leaveTypeId: string; startDate: string; endDate: string; reason: string },
) {
  const employeeId = requireEmployee(auth);
  const leaveType = await db.leaveType.findUnique({ where: { id: payload.leaveTypeId } });
  if (!leaveType) throw new AppError(422, "Unknown leave type");

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (endDate < startDate) throw new AppError(422, "End date cannot be before start date");

  const overlap = await db.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) throw new AppError(422, "Requested dates overlap with another leave request");

  const year = startDate.getUTCFullYear();
  const { weekend, holidaySet } = await getWeekendAndHolidays(year);
  const workingDays = countWorkingDays(startDate, endDate, weekend, holidaySet);
  if (workingDays <= 0) throw new AppError(422, "Selected dates do not include working days");

  if (leaveType.yearlyQuota !== null) {
    const balances = await getLeaveBalances(auth, employeeId, year);
    const balance = balances.find((item) => item.leaveTypeId === leaveType.id);
    if (!balance) throw new AppError(422, "Leave type balance is unavailable");
    if ((balance.remaining ?? 0) < workingDays) throw new AppError(422, "Leave balance is not enough for this request");
  }

  const created = await db.leaveRequest.create({
    data: {
      employeeId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      reason: payload.reason,
      days: new Prisma.Decimal(workingDays),
    },
    include: { leaveType: true },
  });
  await audit(auth.userId, "CREATE", "LEAVE_REQUEST", created.id, null, created as unknown as Prisma.JsonObject);
  return created;
}

export async function cancelLeave(auth: TokenPayload, leaveRequestId: string) {
  const employeeId = requireEmployee(auth);
  const before = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  if (!before || before.employeeId !== employeeId) throw new AppError(404, "Leave request not found");
  const now = new Date();
  if (before.status === "PENDING" || (before.status === "APPROVED" && before.startDate > now)) {
    const updated = await db.leaveRequest.update({
      where: { id: leaveRequestId },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await audit(auth.userId, "UPDATE", "LEAVE_REQUEST", leaveRequestId, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
    return updated;
  }
  throw new AppError(422, "This leave request can no longer be cancelled");
}

export async function listLeaveRequests(
  auth: TokenPayload,
  query: { status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; employeeId?: string; year?: number },
) {
  if (auth.role === "EMPLOYEE" && query.employeeId && query.employeeId !== auth.employeeId) throw new AppError(403, "You may only access your own records");
  const where: Prisma.LeaveRequestWhereInput = {};
  if (auth.role === "EMPLOYEE") where.employeeId = auth.employeeId;
  if (auth.role !== "EMPLOYEE" && query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;
  if (query.year) {
    where.startDate = {
      gte: new Date(`${query.year}-01-01T00:00:00.000Z`),
      lte: new Date(`${query.year}-12-31T23:59:59.999Z`),
    };
  }
  return db.leaveRequest.findMany({
    where,
    include: { employee: true, leaveType: true, approvedBy: { select: { id: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveLeave(auth: TokenPayload, leaveRequestId: string, comment: string) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can approve leave requests");
  const before = await db.leaveRequest.findUnique({ where: { id: leaveRequestId }, include: { employee: true, leaveType: true } });
  if (!before) throw new AppError(404, "Leave request not found");
  if (before.status !== "PENDING") throw new AppError(422, "Only pending leave requests can be approved");

  if (before.leaveType.yearlyQuota !== null) {
    const balances = await getLeaveBalances(auth, before.employeeId, before.startDate.getUTCFullYear());
    const balance = balances.find((item) => item.leaveTypeId === before.leaveTypeId);
    if (!balance || (balance.remaining ?? 0) < Number(before.days)) throw new AppError(422, "Leave balance is not enough for this request");
  }

  const updated = await db.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: "APPROVED", approvedById: auth.userId, approvedAt: new Date(), comment },
  });
  await db.notification.create({
    data: {
      userId: before.employee.userId,
      title: "Leave request approved",
      message: `Your leave from ${before.startDate.toISOString().slice(0, 10)} to ${before.endDate.toISOString().slice(0, 10)} was approved.`,
    },
  });
  await audit(auth.userId, "APPROVE", "LEAVE_REQUEST", leaveRequestId, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function rejectLeave(auth: TokenPayload, leaveRequestId: string, comment: string) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can reject leave requests");
  const before = await db.leaveRequest.findUnique({ where: { id: leaveRequestId }, include: { employee: true } });
  if (!before) throw new AppError(404, "Leave request not found");
  if (before.status !== "PENDING") throw new AppError(422, "Only pending leave requests can be rejected");
  const updated = await db.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: "REJECTED", approvedById: auth.userId, approvedAt: new Date(), comment },
  });
  await db.notification.create({
    data: {
      userId: before.employee.userId,
      title: "Leave request rejected",
      message: `Your leave request was rejected. Comment: ${comment}`,
    },
  });
  await audit(auth.userId, "REJECT", "LEAVE_REQUEST", leaveRequestId, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}
