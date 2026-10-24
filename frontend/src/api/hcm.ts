import { queryString, request, requestBlob } from "./client";
import type {
  AdminDashboard,
  Announcement,
  Attendance,
  AttendanceCorrection,
  AttendanceStatus,
  AuditPage,
  CsvDryRunResult,
  CsvImportRow,
  Department,
  Designation,
  Employee,
  EmployeeCreateInput,
  EmployeeCreateResult,
  EmployeeDashboard,
  EmployeePage,
  EmployeeUpdateInput,
  EmploymentStatus,
  Holiday,
  HrDashboard,
  HrUser,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  Notification,
  OrganizationSettings,
  PayrollRun,
  PublicUser,
  Role,
  Session,
} from "./types";

type EntityInput = { name: string; description?: string };
type LeaveTypeInput = { name: string; yearlyQuota: number | null; isPaid: boolean };
type HolidayInput = { name: string; date: string };
type UserCreateInput = { email: string; password: string; name?: string };
type AttendanceQuery = { from: string; to: string; employeeId?: string };
type LeaveListQuery = { status?: LeaveStatus; employeeId?: string; year?: number };
type PayrollFilter = { month?: number; year?: number };
type CsvConfirmedRow = CsvImportRow;

function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

function listPath(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
  return `${path}${queryString(params ?? {})}`;
}

function namedEntityApi<T>(path: string) {
  return {
    list: () => request<T[]>(`/org/${path}`),
    create: (body: EntityInput) => request<T>(`/org/${path}`, { method: "POST", body: jsonBody(body) }),
    update: (id: string, body: EntityInput) => request<T>(`/org/${path}/${id}`, { method: "PUT", body: jsonBody(body) }),
    remove: (id: string) => request<void>(`/org/${path}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  auth: {
    setupStatus: () => request<{ needsSetup: boolean }>("/auth/setup-status"),
    setup: (body: { companyName: string; email: string; password: string }) =>
      request<Session>("/auth/setup", { method: "POST", body: jsonBody(body) }),
    login: (body: { email: string; password: string }) =>
      request<Session>("/auth/login", { method: "POST", body: jsonBody(body) }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<void>("/auth/change-password", { method: "POST", body: jsonBody(body) }),
  },

  organization: {
    settings: () => request<OrganizationSettings>("/org/settings"),
    saveSettings: (body: OrganizationSettings) =>
      request<OrganizationSettings>("/org/settings", { method: "PUT", body: jsonBody(body) }),
    bootstrapDefaultLeaveTypes: () => request<void>("/org/bootstrap-default-leaves", { method: "POST", body: jsonBody({}) }),
    departments: namedEntityApi<Department>("departments"),
    designations: namedEntityApi<Designation>("designations"),
    leaveTypes: {
      list: () => request<LeaveType[]>("/org/leave-types"),
      create: (body: LeaveTypeInput) => request<LeaveType>("/org/leave-types", { method: "POST", body: jsonBody(body) }),
      update: (id: string, body: LeaveTypeInput) =>
        request<LeaveType>(`/org/leave-types/${id}`, { method: "PUT", body: jsonBody(body) }),
      remove: (id: string) => request<void>(`/org/leave-types/${id}`, { method: "DELETE" }),
    },
    holidays: {
      list: () => request<Holiday[]>("/org/holidays"),
      create: (body: HolidayInput) => request<Holiday>("/org/holidays", { method: "POST", body: jsonBody(body) }),
      update: (id: string, body: HolidayInput) =>
        request<Holiday>(`/org/holidays/${id}`, { method: "PUT", body: jsonBody(body) }),
      remove: (id: string) => request<void>(`/org/holidays/${id}`, { method: "DELETE" }),
    },
    hrUsers: {
      list: () => request<HrUser[]>("/org/hr-users"),
      create: (body: UserCreateInput) =>
        request<{ id: string; email: string; role: Role; name: string | null }>("/org/hr-users", { method: "POST", body: jsonBody(body) }),
      setActive: (id: string, isActive: boolean) =>
        request<Pick<HrUser, "id" | "email" | "isActive">>(`/org/users/${id}`, { method: "PATCH", body: jsonBody({ isActive }) }),
      resetPassword: (id: string, password: string) =>
        request<void>(`/org/users/${id}/reset-password`, { method: "POST", body: jsonBody({ password }) }),
    },
  },

  employees: {
    list: (filter: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentId?: string;
      status?: EmploymentStatus;
    }) => request<EmployeePage>(listPath("/employees", filter)),
    get: (id: string) => request<Employee>(`/employees/${id}`),
    me: () => request<Employee>("/employees/me"),
    create: (body: EmployeeCreateInput) =>
      request<EmployeeCreateResult>("/employees", { method: "POST", body: jsonBody(body) }),
    update: (id: string, body: EmployeeUpdateInput) =>
      request<Employee>(`/employees/${id}`, { method: "PATCH", body: jsonBody(body) }),
    updateMe: (body: { phone?: string | null; address?: string | null }) =>
      request<Employee>("/employees/me", { method: "PATCH", body: jsonBody(body) }),
    enrollFace: (descriptor: number[]) =>
      request<{ enrolled: boolean; employeeId: string }>("/employees/me/face-descriptor", {
        method: "PATCH",
        body: jsonBody({ descriptor }),
      }),
    resetFace: (id: string) =>
      request<{ reset: boolean }>(`/employees/${id}/reset-face`, { method: "POST", body: jsonBody({}) }),
    dryRunCsv: (csv: string) =>
      request<CsvDryRunResult>("/employees/import/csv/dry-run", { method: "POST", body: jsonBody({ csv }) }),
    confirmCsv: (rows: CsvConfirmedRow[]) =>
      request<EmployeeCreateResult[]>("/employees/import/csv/confirm", { method: "POST", body: jsonBody({ rows }) }),
    exportCsv: () => requestBlob("/employees/export/csv", "employees.csv"),
  },

  attendance: {
    checkIn: (body: {
      source?: "WEB" | "CAMERA" | "CORRECTION";
      lat?: number;
      lng?: number;
      accuracy?: number;
      faceCount?: number;
      faceDescriptor?: number[];
      blinkVerified?: boolean;
    }) => request<Attendance>("/attendance/check-in", { method: "POST", body: jsonBody(body) }),
    checkOut: (body: { source?: "WEB" | "CAMERA" | "CORRECTION"; lat?: number; lng?: number; accuracy?: number } = {}) =>
      request<Attendance>("/attendance/check-out", { method: "POST", body: jsonBody(body) }),
    calendar: (filter: AttendanceQuery) => request<Attendance[]>(listPath("/attendance/calendar", filter)),
    board: (date: string) => request<Attendance[]>(listPath("/attendance/board", { date })),
    corrections: (status?: "PENDING" | "APPROVED" | "REJECTED") =>
      request<AttendanceCorrection[]>(listPath("/attendance/corrections", { status })),
    requestCorrection: (body: { date: string; checkIn?: string; checkOut?: string; reason: string }) =>
      request<AttendanceCorrection>("/attendance/corrections", { method: "POST", body: jsonBody(body) }),
    approveCorrection: (id: string, body: { comment?: string; checkIn?: string; checkOut?: string }) =>
      request<AttendanceCorrection>(`/attendance/corrections/${id}/approve`, { method: "POST", body: jsonBody(body) }),
    rejectCorrection: (id: string, comment?: string) =>
      request<AttendanceCorrection>(`/attendance/corrections/${id}/reject`, {
        method: "POST",
        body: jsonBody(comment ? { comment } : {}),
      }),
  },

  leave: {
    apply: (body: { leaveTypeId: string; startDate: string; endDate: string; reason: string }) =>
      request<LeaveRequest>("/leave/requests", { method: "POST", body: jsonBody(body) }),
    cancel: (id: string) => request<LeaveRequest>(`/leave/requests/${id}/cancel`, { method: "POST", body: jsonBody({}) }),
    requests: (filter: LeaveListQuery = {}) => request<LeaveRequest[]>(listPath("/leave/requests", filter)),
    balanceMe: (year?: number) => request<LeaveBalance[]>(listPath("/leave/balance/me", { year })),
    balance: (employeeId: string, year?: number) =>
      request<LeaveBalance[]>(listPath(`/leave/balance/${employeeId}`, { year })),
    approve: (id: string, comment: string) =>
      request<LeaveRequest>(`/leave/requests/${id}/approve`, { method: "POST", body: jsonBody({ comment }) }),
    reject: (id: string, comment: string) =>
      request<LeaveRequest>(`/leave/requests/${id}/reject`, { method: "POST", body: jsonBody({ comment }) }),
  },

  payroll: {
    createDraft: (month: number, year: number) =>
      request<PayrollRun>("/payroll/runs/draft", { method: "POST", body: jsonBody({ month, year }) }),
    finalize: (id: string) => request<PayrollRun>(`/payroll/runs/${id}/finalize`, { method: "POST", body: jsonBody({}) }),
    runs: (filter: PayrollFilter = {}) => request<PayrollRun[]>(listPath("/payroll/runs", filter)),
    payslips: (runId: string) => request<PayrollRun["payslips"]>(`/payroll/runs/${runId}/payslips`),
    downloadPayslip: (id: string) => requestBlob(`/payroll/payslips/${id}/pdf`, `payslip-${id}.pdf`),
  },

  analytics: {
    hrDashboard: (filter: { from: string; to: string; departmentId?: string }) =>
      request<HrDashboard>(listPath("/analytics/hr-dashboard", filter)),
    adminDashboard: (filter: { from: string; to: string; departmentId?: string }) =>
      request<AdminDashboard>(listPath("/analytics/admin-dashboard", filter)),
    employeeDashboard: () => request<EmployeeDashboard>("/analytics/employee-dashboard"),
  },

  ai: {
    chat: (message: string, filters?: { from?: string; to?: string; departmentId?: string }) =>
      request<{ text: string; aiGenerated: boolean }>("/ai/chat", { method: "POST", body: jsonBody({ message, ...filters }) }),
    summarize: (kpis: Record<string, unknown>, context?: string) =>
      request<{ text: string; aiGenerated: boolean }>("/ai/summarize", { method: "POST", body: jsonBody({ kpis, context }) }),
    smartLeave: (text: string) =>
      request<{ type: string; start: string; end: string; reason: string; aiGenerated: boolean; fallback?: boolean }>(
        "/ai/smart-leave",
        { method: "POST", body: jsonBody({ text }) },
      ),
  },

  comms: {
    announcements: () => request<Announcement[]>("/comms/announcements"),
    postAnnouncement: (body: { title: string; body: string }) =>
      request<Announcement>("/comms/announcements", { method: "POST", body: jsonBody(body) }),
    notifications: () => request<Notification[]>("/comms/notifications"),
    unreadCount: () => request<{ count: number }>("/comms/notifications/unread-count"),
    markNotificationRead: (id: string) =>
      request<Notification>(`/comms/notifications/${id}/read`, { method: "POST", body: jsonBody({}) }),
    auditLogs: (filter: { actorId?: string; action?: string; entity?: string; page?: number; pageSize?: number } = {}) =>
      request<AuditPage>(listPath("/comms/audit-logs", filter)),
  },
};

export type AuthRole = Role;
export type { AttendanceStatus };
export type { PublicUser };
