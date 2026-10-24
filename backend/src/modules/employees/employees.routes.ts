import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
  selfProfileSchema,
  updateEmployeeSchema,
} from "./employees.schemas.js";
import {
  createEmployee,
  getEmployeeById,
  getMyEmployeeProfile,
  listEmployees,
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

export default router;
