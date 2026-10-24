import { z } from "zod";

const employmentStatus = z.enum(["ACTIVE", "PROBATION", "INACTIVE", "RESIGNED", "TERMINATED"]);

export const createEmployeeSchema = z.object({
  body: z.object({
    employeeCode: z.string().trim().min(2).max(50),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().email(),
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(400).optional(),
    dateOfBirth: z.string().date().optional(),
    joiningDate: z.string().date(),
    leavingDate: z.string().date().optional(),
    status: employmentStatus.default("ACTIVE"),
    basicSalary: z.number().positive(),
    departmentId: z.string().uuid().optional(),
    designationId: z.string().uuid().optional(),
  }),
});

export const updateEmployeeSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    address: z.string().trim().max(400).nullable().optional(),
    dateOfBirth: z.string().date().nullable().optional(),
    joiningDate: z.string().date().optional(),
    leavingDate: z.string().date().nullable().optional(),
    status: employmentStatus.optional(),
    basicSalary: z.number().positive().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    designationId: z.string().uuid().nullable().optional(),
  }),
});

export const selfProfileSchema = z.object({
  body: z.object({
    phone: z.string().trim().max(30).nullable().optional(),
    address: z.string().trim().max(400).nullable().optional(),
  }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listEmployeesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    departmentId: z.string().uuid().optional(),
    status: employmentStatus.optional(),
  }),
});

export const csvDryRunSchema = z.object({
  body: z.object({
    csv: z.string().min(1),
  }),
});

export const csvConfirmSchema = z.object({
  body: z.object({
    rows: z.array(
      z.object({
        employeeCode: z.string().trim().min(2).max(50),
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        email: z.string().email(),
        joiningDate: z.string().date(),
        basicSalary: z.number().positive(),
        departmentId: z.string().uuid().optional(),
        designationId: z.string().uuid().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      }),
    ),
  }),
});

export const faceEnrollmentSchema = z.object({
  body: z.object({
    descriptor: z.array(z.number()).length(128),
  }),
});
