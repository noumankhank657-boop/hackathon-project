export type Role = "ADMIN" | "HR" | "EMPLOYEE";

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  employeeId?: string;
}

export interface Session {
  token: string;
  user: PublicUser;
}

export type EmploymentStatus = "ACTIVE" | "PROBATION" | "INACTIVE" | "RESIGNED" | "TERMINATED";
export type AttendanceStatus = "PRESENT" | "LATE" | "HALF_DAY" | "MISSING_CHECKOUT" | "ABSENT" | "ON_LEAVE";
export type AttendanceSource = "WEB" | "CAMERA" | "CORRECTION";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface Department {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Designation {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveType {
  id: string;
  name: string;
  yearlyQuota: number | null;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  officeStart: string;
  graceMinutes: number;
  halfDayHours: number;
  weekend: number[];
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
}

export interface HrUser {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  name: string | null;
}

export interface Employee {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  joiningDate: string;
  leavingDate: string | null;
  status: EmploymentStatus;
  basicSalary: string | number;
  departmentId: string | null;
  designationId: string | null;
  faceDescriptor?: number[] | null;
  createdAt: string;
  updatedAt: string;
  user?: EmployeeUser;
  department?: Department | null;
  designation?: Designation | null;
}

export interface EmployeePage {
  total: number;
  page: number;
  pageSize: number;
  rows: Employee[];
}

export interface EmployeeCreateInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  joiningDate: string;
  leavingDate?: string;
  status: EmploymentStatus;
  basicSalary: number;
  departmentId?: string;
  designationId?: string;
}

export interface EmployeeUpdateInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  joiningDate?: string;
  leavingDate?: string | null;
  status?: EmploymentStatus;
  basicSalary?: number;
  departmentId?: string | null;
  designationId?: string | null;
}

export interface EmployeeCreateResult {
  employee: Employee;
  temporaryPassword: string;
}

export interface CsvImportRow {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  joiningDate: string;
  basicSalary: number;
  departmentId?: string;
  designationId?: string;
  phone?: string;
  address?: string;
}

export interface CsvImportError {
  row: number;
  field: string;
  reason: string;
}

export interface CsvDryRunResult {
  validRows: CsvImportRow[];
  errors: CsvImportError[];
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  source: AttendanceSource;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  faceMatchScore: number | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee & { user?: Pick<EmployeeUser, "email"> };
}

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  attendanceId: string | null;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comment: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee?: Employee & { user?: Pick<EmployeeUser, "email"> };
  attendance?: Attendance | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: string | number;
  reason: string;
  status: LeaveStatus;
  comment: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  leaveType: LeaveType;
  employee?: Employee;
}

export interface LeaveBalance {
  leaveTypeId: string;
  name: string;
  isPaid: boolean;
  quota: number | null;
  used: number;
  remaining: number | null;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  basic: string | number;
  hra: string | number;
  medical: string | number;
  gross: string | number;
  deductions: string | number;
  tax: string | number;
  net: string | number;
  employee?: Employee;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: "DRAFT" | "FINALIZED";
  createdAt: string;
  finalizedAt: string | null;
  payslips: Payslip[];
}

export interface HrDashboard {
  kpis: {
    headcount: number;
    present: number;
    onLeaveToday: number;
    lateToday: number;
    pendingLeave: number;
    pendingCorrections: number;
  };
  attendanceTrend: Array<{ date: string; status: AttendanceStatus }>;
  absenteeismByDept: Array<{ department: string; absenteeismPercent: number }>;
  lateByDept: Array<{ department: string; latePercent: number }>;
  leaveByType: Array<{ name: string; days: number }>;
  topLateComers: Array<{ employeeId: string; name: string; lateCount: number }>;
}

export interface AdminDashboard {
  kpis: { headcount: number; attrition: number; payrollCost: number; averageSalary: number };
  payrollCostByDepartment: Array<{ department: string; net: number }>;
  headcountByDepartment: Array<{ department: string; count: number }>;
  genderTenure: { note?: string };
  auditFeed: Array<{ id: string; actor: string; action: string; entity: string; createdAt: string }>;
  totals: { gross: number; net: number };
}

export interface EmployeeDashboard {
  checkInState: Attendance | null;
  weeklyHours: number;
  weeklyTarget: number;
  lateCount: number;
  leaveBalances: LeaveBalance[];
  lastPayslip: Payslip | null;
  announcements: Announcement[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
  author?: Pick<EmployeeUser, "id" | "email" | "name">;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor?: { id: string; email: string } | null;
}

export interface AuditPage {
  total: number;
  page: number;
  pageSize: number;
  rows: AuditLog[];
}
