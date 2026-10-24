import { db } from "../../lib/db.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";
import { getLeaveBalances } from "../leave/leave.service.js";

type AnalyticsFilter = { from: string; to: string; departmentId?: string };

function getRange(filter: AnalyticsFilter) {
  const from = new Date(filter.from);
  const to = new Date(filter.to);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function getWorkingDays(from: Date, to: Date) {
  const setting = await db.setting.findUnique({ where: { key: "organization" } });
  const weekend = new Set<number>(((setting?.value as { weekend?: number[] } | null)?.weekend ?? [0, 6]).map(Number));
  const holidays = await db.holiday.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true } });
  const holidaySet = new Set(holidays.map((item) => item.date.toISOString().slice(0, 10)));
  let days = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    if (!weekend.has(cursor.getDay()) && !holidaySet.has(key)) {
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function getHrDashboard(auth: TokenPayload, filter: AnalyticsFilter) {
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can access this dashboard");
  const { from, to } = getRange(filter);
  const employeeWhere = {
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
  };
  const [headcount, attendanceRows, leaveRows, pendingLeave, pendingCorrections, employees] = await Promise.all([
    db.employee.count({ where: { ...employeeWhere, status: { in: ["ACTIVE", "PROBATION"] } } }),
    db.attendance.findMany({
      where: {
        date: { gte: from, lte: to },
        employee: employeeWhere,
      },
      include: { employee: { include: { department: true } } },
    }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: to }, endDate: { gte: from }, employee: employeeWhere },
      include: { leaveType: true, employee: { include: { department: true } } },
    }),
    db.leaveRequest.count({ where: { status: "PENDING" } }),
    db.attendanceCorrection.count({ where: { status: "PENDING" } }),
    db.employee.findMany({ where: employeeWhere, include: { department: true } }),
  ]);

  const present = attendanceRows.filter((row) => ["PRESENT", "LATE", "MISSING_CHECKOUT", "HALF_DAY"].includes(row.status)).length;
  const lateToday = attendanceRows.filter((row) => row.status === "LATE" && row.date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const onLeaveToday = leaveRows.filter((row) => {
    const today = new Date();
    return row.startDate <= today && row.endDate >= today;
  }).length;

  const lateByDepartmentMap = new Map<string, { department: string; late: number; total: number }>();
  attendanceRows.forEach((row) => {
    const key = row.employee.department?.name ?? "Unassigned";
    const existing = lateByDepartmentMap.get(key) ?? { department: key, late: 0, total: 0 };
    existing.total += 1;
    if (row.status === "LATE") existing.late += 1;
    lateByDepartmentMap.set(key, existing);
  });

  const workingDays = await getWorkingDays(from, to);
  const absenteeismByDept = Array.from(lateByDepartmentMap.values()).map((item) => {
    const deptEmployees = employees.filter((employee) => (employee.department?.name ?? "Unassigned") === item.department).length || 1;
    const expected = deptEmployees * workingDays;
    const attended = attendanceRows.filter((row) => (row.employee.department?.name ?? "Unassigned") === item.department).length;
    return {
      department: item.department,
      absenteeismPercent: expected > 0 ? ((expected - attended) / expected) * 100 : 0,
    };
  });

  const leaveByTypeMap = new Map<string, number>();
  leaveRows.forEach((leave) => {
    leaveByTypeMap.set(leave.leaveType.name, (leaveByTypeMap.get(leave.leaveType.name) ?? 0) + Number(leave.days));
  });
  const leaveByType = Array.from(leaveByTypeMap.entries()).map(([name, days]) => ({ name, days }));

  const attendanceTrendMap = new Map<
    string,
    { date: string; present: number; late: number; halfDay: number; missingCheckout: number; absent: number; onLeave: number }
  >();
  attendanceRows.forEach((row) => {
    const date = row.date.toISOString().slice(0, 10);
    const aggregate = attendanceTrendMap.get(date) ?? {
      date,
      present: 0,
      late: 0,
      halfDay: 0,
      missingCheckout: 0,
      absent: 0,
      onLeave: 0,
    };
    if (row.status === "PRESENT") aggregate.present += 1;
    if (row.status === "LATE") aggregate.late += 1;
    if (row.status === "HALF_DAY") aggregate.halfDay += 1;
    if (row.status === "MISSING_CHECKOUT") aggregate.missingCheckout += 1;
    if (row.status === "ABSENT") aggregate.absent += 1;
    if (row.status === "ON_LEAVE") aggregate.onLeave += 1;
    attendanceTrendMap.set(date, aggregate);
  });

  const lateComers = await db.attendance.groupBy({
    by: ["employeeId"],
    where: {
      date: { gte: from, lte: to },
      status: "LATE",
      employee: employeeWhere,
    },
    _count: { employeeId: true },
    orderBy: { _count: { employeeId: "desc" } },
    take: 5,
  });
  const lateEmployees = await db.employee.findMany({ where: { id: { in: lateComers.map((item) => item.employeeId) } } });
  const topLateComers = lateComers.map((item) => {
    const employee = lateEmployees.find((row) => row.id === item.employeeId);
    return {
      employeeId: item.employeeId,
      name: `${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`.trim(),
      lateCount: item._count.employeeId,
    };
  });

  return {
    kpis: { headcount, present, onLeaveToday, lateToday, pendingLeave, pendingCorrections },
    attendanceTrend: Array.from(attendanceTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    absenteeismByDept,
    lateByDept: Array.from(lateByDepartmentMap.values()).map((item) => ({
      department: item.department,
      latePercent: item.total > 0 ? (item.late / item.total) * 100 : 0,
    })),
    leaveByType,
    topLateComers,
  };
}

export async function getAdminDashboard(auth: TokenPayload, filter: AnalyticsFilter) {
  if (auth.role !== "ADMIN") throw new AppError(403, "Only Admin can access this dashboard");
  const { from, to } = getRange(filter);
  const employeeWhere = {
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
  };
  const [headcount, exits, payrollRuns, employees, auditFeed] = await Promise.all([
    db.employee.count({ where: { ...employeeWhere, status: { in: ["ACTIVE", "PROBATION"] } } }),
    db.employee.count({ where: { ...employeeWhere, leavingDate: { gte: from, lte: to } } }),
    db.payrollRun.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { payslips: { include: { employee: true } } },
    }),
    db.employee.findMany({ where: employeeWhere, include: { department: true, designation: true } }),
    db.auditLog.findMany({ take: 20, orderBy: { createdAt: "desc" }, include: { actor: { select: { email: true } } } }),
  ]);

  const avgHeadcount = headcount || 1;
  const attrition = (exits / avgHeadcount) * 100;
  let totalGross = 0;
  let totalNet = 0;
  payrollRuns.forEach((run) =>
    run.payslips.forEach((payslip) => {
      totalGross += Number(payslip.gross);
      totalNet += Number(payslip.net);
    }),
  );
  const averageSalary = employees.length > 0 ? employees.reduce((sum, item) => sum + Number(item.basicSalary) * 1.5, 0) / employees.length : 0;

  const headcountByDept = Array.from(
    employees.reduce((map, employee) => {
      const key = employee.department?.name ?? "Unassigned";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).map(([department, count]) => ({ department, count }));

  const payrollByDept = Array.from(
    payrollRuns.reduce((map, run) => {
      run.payslips.forEach((payslip) => {
        const department = employees.find((item) => item.id === payslip.employeeId)?.department?.name ?? "Unassigned";
        map.set(department, (map.get(department) ?? 0) + Number(payslip.net));
      });
      return map;
    }, new Map<string, number>()),
  ).map(([department, net]) => ({ department, net }));

  return {
    kpis: { headcount, attrition, payrollCost: totalNet, averageSalary },
    payrollCostByDepartment: payrollByDept,
    headcountByDepartment: headcountByDept,
    genderTenure: { note: "Gender and tenure dimensions are available once employee profile fields are populated." },
    auditFeed: auditFeed.map((item) => ({
      id: item.id,
      actor: item.actor?.email ?? "system",
      action: item.action,
      entity: item.entity,
      createdAt: item.createdAt,
    })),
    totals: { gross: totalGross, net: totalNet },
  };
}

export async function getEmployeeDashboard(auth: TokenPayload) {
  if (auth.role !== "EMPLOYEE" || !auth.employeeId) throw new AppError(403, "Only employees can access this dashboard");
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [attendances, lateCount, balances, runs, announcements] = await Promise.all([
    db.attendance.findMany({ where: { employeeId: auth.employeeId, date: { gte: weekStart, lte: now } } }),
    db.attendance.count({ where: { employeeId: auth.employeeId, date: { gte: monthStart, lte: now }, status: "LATE" } }),
    getLeaveBalances(auth, auth.employeeId, now.getFullYear()),
    db.payrollRun.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { payslips: { where: { employeeId: auth.employeeId } } },
      take: 1,
    }),
    db.announcement.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
  ]);
  const weeklyHours = attendances.reduce((sum, row) => {
    if (!row.checkIn || !row.checkOut) return sum;
    return sum + (row.checkOut.getTime() - row.checkIn.getTime()) / (1000 * 60 * 60);
  }, 0);
  return {
    checkInState: attendances.find((item) => item.date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) ?? null,
    weeklyHours,
    weeklyTarget: 40,
    lateCount,
    leaveBalances: balances,
    lastPayslip: runs[0]?.payslips[0] ?? null,
    announcements,
  };
}
