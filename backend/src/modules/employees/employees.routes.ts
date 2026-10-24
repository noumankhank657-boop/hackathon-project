import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createEmployeeSchema,
  csvConfirmSchema,
  csvDryRunSchema,
  employeeIdParamSchema,
  faceEnrollmentSchema,
  listEmployeesQuerySchema,
  selfProfileSchema,
  updateEmployeeSchema,
} from "./employees.schemas.js";
import {
  confirmImportEmployees,
  createEmployee,
  dryRunImportEmployees,
  enrollFaceDescriptor,
  exportEmployeesCsv,
  getEmployeeById,
  getMyEmployeeProfile,
  listEmployees,
  resetFaceDescriptor,
  updateEmployee,
  updateMyProfile,
} from "./employees.service.js";

const router = Router();

router.post("/", requireAuth, requireRole("ADMIN", "HR"), validate(createEmployeeSchema), async (request, response, next) => {
  try {
    response.status(201).json(await createEmployee(request.auth!.userId, request.body));
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, validate(listEmployeesQuerySchema), async (request, response, next) => {
  try {
    const parsed = listEmployeesQuerySchema.parse({ query: request.query });
    response.json(await listEmployees(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

router.get("/export/csv", requireAuth, async (request, response, next) => {
  try {
    const csv = await exportEmployeesCsv(request.auth!);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", "attachment; filename=\"employees.csv\"");
    response.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post("/import/csv/dry-run", requireAuth, requireRole("ADMIN", "HR"), validate(csvDryRunSchema), async (request, response, next) => {
  try {
    response.json(await dryRunImportEmployees(request.body.csv));
  } catch (error) {
    next(error);
  }
});

router.post("/import/csv/confirm", requireAuth, requireRole("ADMIN", "HR"), validate(csvConfirmSchema), async (request, response, next) => {
  try {
    response.status(201).json(await confirmImportEmployees(request.auth!.userId, request.body.rows));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (request, response, next) => {
  try {
    response.json(await getMyEmployeeProfile(request.auth!));
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requireAuth, requireRole("EMPLOYEE"), validate(selfProfileSchema), async (request, response, next) => {
  try {
    response.json(await updateMyProfile(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.patch("/me/face-descriptor", requireAuth, requireRole("EMPLOYEE"), validate(faceEnrollmentSchema), async (request, response, next) => {
  try {
    response.json(await enrollFaceDescriptor(request.auth!, request.body.descriptor));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, validate(employeeIdParamSchema), async (request, response, next) => {
  try {
    response.json(await getEmployeeById(request.auth!, String(request.params.id)));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, requireRole("ADMIN", "HR"), validate(employeeIdParamSchema.and(updateEmployeeSchema)), async (request, response, next) => {
  try {
    response.json(await updateEmployee(request.auth!.userId, String(request.params.id), request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/reset-face", requireAuth, requireRole("ADMIN", "HR"), validate(employeeIdParamSchema), async (request, response, next) => {
  try {
    response.json(await resetFaceDescriptor(request.auth!, String(request.params.id)));
  } catch (error) {
    next(error);
  }
});

export default router;
