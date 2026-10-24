import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";
import { calculatePayrollAmounts } from "./payroll.rules.js";
import { countWorkingDays } from "../leave/leave.rules.js";

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

async function getWeekendAndHolidays(year: number, month: number) {
  const setting = await db.setting.findUnique({ where: { key: "organization" } });
  const weekend = new Set<number>(((setting?.value as { weekend?: number[] } | null)?.weekend ?? [0, 6]).map(Number));
  const { start, end } = monthBounds(year, month);
  const holidays = await db.holiday.findMany({ where: { date: { gte: start, lte: end } }, select: { date: true } });
  const holidaySet = new Set(holidays.map((item) => item.date.toISOString().slice(0, 10)));
  return { weekend, holidaySet };
}

function workingDaysWithinEmployment(
  monthStart: Date,
  monthEnd: Date,
  joiningDate: Date,
  leavingDate: Date | null,
  weekend: Set<number>,
  holidaySet: Set<string>,
) {
  const start = joiningDate > monthStart ? joiningDate : monthStart;
  const end = leavingDate && leavingDate < monthEnd ? leavingDate : monthEnd;
  if (end < start) return 0;
  return countWorkingDays(start, end, weekend, holidaySet);
}

function overlapDaysInMonth(startDate: Date, endDate: Date, monthStart: Date, monthEnd: Date, weekend: Set<number>, holidaySet: Set<string>) {
  const start = startDate > monthStart ? startDate : monthStart;
  const end = endDate < monthEnd ? endDate : monthEnd;
  if (end < start) return 0;
  return countWorkingDays(start, end, weekend, holidaySet);
}

async function buildPayrollRows(month: number, year: number) {
  const { start, end } = monthBounds(year, month);
  const { weekend, holidaySet } = await getWeekendAndHolidays(year, month);
  const workingDaysInMonth = countWorkingDays(start, end, weekend, holidaySet);

  const employees = await db.employee.findMany({
    where: { status: { in: ["ACTIVE", "PROBATION"] }, joiningDate: { lte: end }, OR: [{ leavingDate: null }, { leavingDate: { gte: start } }] },
    include: { user: true },
  });

  const rows = [];
  for (const employee of employees) {
    const employeeWorkingDays = workingDaysWithinEmployment(start, end, employee.joiningDate, employee.leavingDate, weekend, holidaySet);

    const attendances = await db.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: start, lte: end } },
      select: { status: true },
    });
    const presentLike = attendances.filter((item) => ["PRESENT", "LATE", "MISSING_CHECKOUT"].includes(item.status)).length;
    const halfDays = attendances.filter((item) => item.status === "HALF_DAY").length;

    const approvedLeaves = await db.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { leaveType: true },
    });

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    approvedLeaves.forEach((leave) => {
      const overlap = overlapDaysInMonth(leave.startDate, leave.endDate, start, end, weekend, holidaySet);
      if (leave.leaveType.isPaid) paidLeaveDays += overlap;
      else unpaidLeaveDays += overlap;
    });

    const absentDays = Math.max(0, employeeWorkingDays - presentLike - halfDays - paidLeaveDays - unpaidLeaveDays);
    const amounts = calculatePayrollAmounts({
      basic: Number(employee.basicSalary),
      workingDaysInMonth: workingDaysInMonth || 1,
      absentDays,
      unpaidLeaveDays,
      halfDays,
    });

    rows.push({
      employee,
      basic: Number(employee.basicSalary),
      hra: amounts.hra,
      medical: amounts.medical,
      gross: amounts.gross,
      deductions: amounts.deductions,
      tax: amounts.tax,
      net: amounts.net,
    });
  }
  return rows;
}

export async function createOrRecalculateDraft(auth: TokenPayload, payload: { month: number; year: number }) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can create payroll drafts");
  const existing = await db.payrollRun.findUnique({ where: { month_year: { month: payload.month, year: payload.year } } });
  if (existing && existing.status === "FINALIZED") throw new AppError(409, "This payroll month is already finalized and locked");
  const rows = await buildPayrollRows(payload.month, payload.year);

  const run = existing
    ? await db.payrollRun.update({ where: { id: existing.id }, data: { status: "DRAFT", createdById: auth.userId } })
    : await db.payrollRun.create({ data: { month: payload.month, year: payload.year, status: "DRAFT", createdById: auth.userId } });

  for (const row of rows) {
    await db.payslip.upsert({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: row.employee.id } },
      update: {
        basic: new Prisma.Decimal(row.basic),
        hra: new Prisma.Decimal(row.hra),
        medical: new Prisma.Decimal(row.medical),
        gross: new Prisma.Decimal(row.gross),
        deductions: new Prisma.Decimal(row.deductions),
        tax: new Prisma.Decimal(row.tax),
        net: new Prisma.Decimal(row.net),
      },
      create: {
        payrollRunId: run.id,
        employeeId: row.employee.id,
        basic: new Prisma.Decimal(row.basic),
        hra: new Prisma.Decimal(row.hra),
        medical: new Prisma.Decimal(row.medical),
        gross: new Prisma.Decimal(row.gross),
        deductions: new Prisma.Decimal(row.deductions),
        tax: new Prisma.Decimal(row.tax),
        net: new Prisma.Decimal(row.net),
      },
    });
  }
  await audit(auth.userId, existing ? "UPDATE" : "CREATE", "PAYROLL_RUN", run.id, existing as unknown as Prisma.JsonObject | null, run as unknown as Prisma.JsonObject);
  return db.payrollRun.findUnique({ where: { id: run.id }, include: { payslips: true } });
}

export async function finalizePayrollRun(auth: TokenPayload, runId: string) {
  if (auth.role !== "ADMIN") throw new AppError(403, "Only Admin can finalize payroll");
  const before = await db.payrollRun.findUnique({ where: { id: runId }, include: { payslips: { include: { employee: true } } } });
  if (!before) throw new AppError(404, "Payroll run not found");
  if (before.status === "FINALIZED") throw new AppError(409, "Payroll run is already finalized");
  const updated = await db.payrollRun.update({
    where: { id: runId },
    data: { status: "FINALIZED", finalizedById: auth.userId, finalizedAt: new Date() },
    include: { payslips: true },
  });
  await Promise.all(
    before.payslips.map((payslip) =>
      db.notification.create({
        data: {
          userId: payslip.employee.userId,
          title: "Payslip available",
          message: `Your ${before.month}/${before.year} payslip is now available.`,
        },
      }),
    ),
  );
  await audit(auth.userId, "FINALIZE", "PAYROLL_RUN", runId, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function listPayrollRuns(auth: TokenPayload, query: { month?: number; year?: number }) {
  if (auth.role === "EMPLOYEE") {
    return db.payrollRun.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        payslips: {
          where: { employeeId: auth.employeeId },
        },
      },
    });
  }
  return db.payrollRun.findMany({
    where: { month: query.month, year: query.year },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { payslips: true },
  });
}

export async function getPayrollRunPayslips(auth: TokenPayload, runId: string) {
  const run = await db.payrollRun.findUnique({
    where: { id: runId },
    include: { payslips: { include: { employee: { include: { user: { select: { email: true } } } } } } },
  });
  if (!run) throw new AppError(404, "Payroll run not found");
  if (auth.role === "EMPLOYEE") {
    return run.payslips.filter((item) => item.employeeId === auth.employeeId);
  }
  return run.payslips;
}

export async function getPayslipById(auth: TokenPayload, payslipId: string) {
  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: { payrollRun: true, employee: { include: { user: true, department: true, designation: true } } },
  });
  if (!payslip) throw new AppError(404, "Payslip not found");
  if (auth.role === "EMPLOYEE" && payslip.employeeId !== auth.employeeId) throw new AppError(403, "You may only access your own records");
  return payslip;
}

export async function renderPayslipPdf(auth: TokenPayload, payslipId: string) {
  const payslip = await getPayslipById(auth, payslipId);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument();
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve());
    doc.on("error", (error) => reject(error));
    doc.fontSize(18).text("HCM Lite Payslip", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Employee: ${payslip.employee.firstName} ${payslip.employee.lastName}`);
    doc.text(`Email: ${payslip.employee.user.email}`);
    doc.text(`Month: ${payslip.payrollRun.month}/${payslip.payrollRun.year}`);
    doc.moveDown();
    doc.text(`Basic: ${payslip.basic}`);
    doc.text(`HRA: ${payslip.hra}`);
    doc.text(`Medical: ${payslip.medical}`);
    doc.text(`Gross: ${payslip.gross}`);
    doc.text(`Deductions: ${payslip.deductions}`);
    doc.text(`Tax: ${payslip.tax}`);
    doc.text(`Net Pay: ${payslip.net}`);
    doc.end();
  });
  return Buffer.concat(chunks);
}
