import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";

const generateTempPassword = () => `Tmp-${Math.random().toString(36).slice(2, 8)}!${Date.now().toString().slice(-4)}`;

const employeeInclude = {
  department: true,
  designation: true,
  user: { select: { id: true, email: true, role: true, isActive: true, mustChangePassword: true, name: true } },
} satisfies Prisma.EmployeeInclude;

async function validateDepartmentAndDesignation(input: { departmentId?: string | null; designationId?: string | null }) {
  if (input.departmentId) {
    const found = await db.department.findUnique({ where: { id: input.departmentId } });
    if (!found) throw new AppError(422, "Unknown department");
  }
  if (input.designationId) {
    const found = await db.designation.findUnique({ where: { id: input.designationId } });
    if (!found) throw new AppError(422, "Unknown designation");
  }
}

export async function createEmployee(
  actorId: string,
  payload: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    joiningDate: string;
    leavingDate?: string;
    status: "ACTIVE" | "PROBATION" | "INACTIVE" | "RESIGNED" | "TERMINATED";
    basicSalary: number;
    departmentId?: string;
    designationId?: string;
  },
) {
  await validateDepartmentAndDesignation(payload);
  const email = payload.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "Email already exists");
  const existingCode = await db.employee.findUnique({ where: { employeeCode: payload.employeeCode } });
  if (existingCode) throw new AppError(409, "Employee code already exists");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      role: "EMPLOYEE",
      mustChangePassword: true,
      name: `${payload.firstName} ${payload.lastName}`.trim(),
    },
  });

  let created;
  try {
    created = await db.employee.create({
      data: {
        userId: user.id,
        employeeCode: payload.employeeCode,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        address: payload.address,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        joiningDate: new Date(payload.joiningDate),
        leavingDate: payload.leavingDate ? new Date(payload.leavingDate) : null,
        status: payload.status,
        basicSalary: new Prisma.Decimal(payload.basicSalary),
        departmentId: payload.departmentId,
        designationId: payload.designationId,
      },
      include: employeeInclude,
    });
  } catch (error) {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw error;
  }
  await audit(actorId, "CREATE", "EMPLOYEE", created.id, null, created as unknown as Prisma.JsonObject);
  return { employee: created, temporaryPassword: tempPassword };
}

export async function listEmployees(
  auth: TokenPayload,
  query: { page: number; pageSize: number; search?: string; departmentId?: string; status?: "ACTIVE" | "PROBATION" | "INACTIVE" | "RESIGNED" | "TERMINATED" },
) {
  const where: Prisma.EmployeeWhereInput = {};
  if (auth.role === "EMPLOYEE") where.id = auth.employeeId;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { employeeCode: { contains: query.search, mode: "insensitive" } },
      { user: { email: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, page: query.page, pageSize: query.pageSize, rows };
}

export async function getEmployeeById(auth: TokenPayload, employeeId: string) {
  if (auth.role === "EMPLOYEE" && auth.employeeId !== employeeId) throw new AppError(403, "You may only access your own records");
  const employee = await db.employee.findUnique({ where: { id: employeeId }, include: employeeInclude });
  if (!employee) throw new AppError(404, "Employee not found");
  return employee;
}

export async function getMyEmployeeProfile(auth: TokenPayload) {
  if (!auth.employeeId) throw new AppError(403, "Employee profile not available");
  return getEmployeeById(auth, auth.employeeId);
}

export async function updateEmployee(
  actorId: string,
  employeeId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    address?: string | null;
    dateOfBirth?: string | null;
    joiningDate?: string;
    leavingDate?: string | null;
    status?: "ACTIVE" | "PROBATION" | "INACTIVE" | "RESIGNED" | "TERMINATED";
    basicSalary?: number;
    departmentId?: string | null;
    designationId?: string | null;
  },
) {
  await validateDepartmentAndDesignation({ departmentId: payload.departmentId, designationId: payload.designationId });
  const before = await db.employee.findUnique({ where: { id: employeeId }, include: employeeInclude });
  if (!before) throw new AppError(404, "Employee not found");

  const updated = await db.employee.update({
    where: { id: employeeId },
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      address: payload.address,
      dateOfBirth: payload.dateOfBirth === undefined ? undefined : payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
      joiningDate: payload.joiningDate ? new Date(payload.joiningDate) : undefined,
      leavingDate: payload.leavingDate === undefined ? undefined : payload.leavingDate ? new Date(payload.leavingDate) : null,
      status: payload.status,
      basicSalary: payload.basicSalary === undefined ? undefined : new Prisma.Decimal(payload.basicSalary),
      departmentId: payload.departmentId,
      designationId: payload.designationId,
    },
    include: employeeInclude,
  });
  await audit(actorId, "UPDATE", "EMPLOYEE", employeeId, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}

export async function updateMyProfile(auth: TokenPayload, payload: { phone?: string | null; address?: string | null }) {
  if (!auth.employeeId) throw new AppError(403, "Employee profile not available");
  const before = await db.employee.findUnique({ where: { id: auth.employeeId } });
  if (!before) throw new AppError(404, "Employee not found");
  const updated = await db.employee.update({
    where: { id: auth.employeeId },
    data: {
      phone: payload.phone,
      address: payload.address,
    },
    include: employeeInclude,
  });
  await audit(auth.userId, "UPDATE", "EMPLOYEE_PROFILE", auth.employeeId, before as unknown as Prisma.JsonObject, updated as unknown as Prisma.JsonObject);
  return updated;
}
