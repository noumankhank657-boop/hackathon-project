import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createHrUserSchema,
  holidaySchema,
  idParamSchema,
  leaveTypeSchema,
  namedEntitySchema,
  organizationSettingsSchema,
  resetUserPasswordSchema,
  userActivationSchema,
} from "./org.schemas.js";
import {
  createHoliday,
  createHrLogin,
  createLeaveType,
  createNamedEntity,
  deleteHoliday,
  deleteLeaveType,
  deleteNamedEntity,
  ensureDefaultLeaveTypes,
  getOrganizationSettings,
  listHolidays,
  listHrUsers,
  listLeaveTypes,
  listNamedEntities,
  resetUserPassword,
  setUserActive,
  updateHoliday,
  updateLeaveType,
  updateNamedEntity,
  upsertOrganizationSettings,
} from "./org.service.js";

const router = Router();

router.get("/settings", requireAuth, requireRole("ADMIN", "HR"), async (_request, response, next) => {
  try {
    response.json(await getOrganizationSettings());
  } catch (error) {
    next(error);
  }
});

router.put("/settings", requireAuth, requireRole("ADMIN"), validate(organizationSettingsSchema), async (request, response, next) => {
  try {
    response.json(await upsertOrganizationSettings(request.auth!.userId, request.body));
  } catch (error) {
    next(error);
  }
});

for (const [path, type] of [
  ["departments", "department"],
  ["designations", "designation"],
] as const) {
  router.get(`/${path}`, requireAuth, requireRole("ADMIN", "HR"), async (_request, response, next) => {
    try {
      response.json(await listNamedEntities(type));
    } catch (error) {
      next(error);
    }
  });

  router.post(`/${path}`, requireAuth, requireRole("ADMIN"), validate(namedEntitySchema), async (request, response, next) => {
    try {
      response.status(201).json(await createNamedEntity(request.auth!.userId, type, request.body));
    } catch (error) {
      next(error);
    }
  });

  router.put(`/${path}/:id`, requireAuth, requireRole("ADMIN"), validate(idParamSchema.and(namedEntitySchema)), async (request, response, next) => {
    try {
      response.json(await updateNamedEntity(request.auth!.userId, type, String(request.params.id), request.body));
    } catch (error) {
      next(error);
    }
  });

  router.delete(`/${path}/:id`, requireAuth, requireRole("ADMIN"), validate(idParamSchema), async (request, response, next) => {
    try {
      await deleteNamedEntity(request.auth!.userId, type, String(request.params.id));
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
}

router.get("/leave-types", requireAuth, requireRole("ADMIN", "HR", "EMPLOYEE"), async (_request, response, next) => {
  try {
    response.json(await listLeaveTypes());
  } catch (error) {
    next(error);
  }
});

router.post("/leave-types", requireAuth, requireRole("ADMIN"), validate(leaveTypeSchema), async (request, response, next) => {
  try {
    response.status(201).json(await createLeaveType(request.auth!.userId, request.body));
  } catch (error) {
    next(error);
  }
});

router.put("/leave-types/:id", requireAuth, requireRole("ADMIN"), validate(idParamSchema.and(leaveTypeSchema)), async (request, response, next) => {
  try {
    response.json(await updateLeaveType(request.auth!.userId, String(request.params.id), request.body));
  } catch (error) {
    next(error);
  }
});

router.delete("/leave-types/:id", requireAuth, requireRole("ADMIN"), validate(idParamSchema), async (request, response, next) => {
  try {
    await deleteLeaveType(request.auth!.userId, String(request.params.id));
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/holidays", requireAuth, requireRole("ADMIN", "HR"), async (_request, response, next) => {
  try {
    response.json(await listHolidays());
  } catch (error) {
    next(error);
  }
});

router.post("/holidays", requireAuth, requireRole("ADMIN"), validate(holidaySchema), async (request, response, next) => {
  try {
    response.status(201).json(await createHoliday(request.auth!.userId, request.body));
  } catch (error) {
    next(error);
  }
});

router.put("/holidays/:id", requireAuth, requireRole("ADMIN"), validate(idParamSchema.and(holidaySchema)), async (request, response, next) => {
  try {
    response.json(await updateHoliday(request.auth!.userId, String(request.params.id), request.body));
  } catch (error) {
    next(error);
  }
});

router.delete("/holidays/:id", requireAuth, requireRole("ADMIN"), validate(idParamSchema), async (request, response, next) => {
  try {
    await deleteHoliday(request.auth!.userId, String(request.params.id));
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/hr-users", requireAuth, requireRole("ADMIN"), async (_request, response, next) => {
  try {
    response.json(await listHrUsers());
  } catch (error) {
    next(error);
  }
});

router.post("/hr-users", requireAuth, requireRole("ADMIN"), validate(createHrUserSchema), async (request, response, next) => {
  try {
    response.status(201).json(await createHrLogin(request.auth!.userId, request.body));
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", requireAuth, requireRole("ADMIN"), validate(idParamSchema.and(userActivationSchema)), async (request, response, next) => {
  try {
    response.json(await setUserActive(request.auth!.userId, String(request.params.id), request.body.isActive));
  } catch (error) {
    next(error);
  }
});

router.post(
  "/users/:id/reset-password",
  requireAuth,
  requireRole("ADMIN"),
  validate(idParamSchema.and(resetUserPasswordSchema)),
  async (request, response, next) => {
    try {
      await resetUserPassword(request.auth!.userId, String(request.params.id), request.body.password);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.post("/bootstrap-default-leaves", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  try {
    await ensureDefaultLeaveTypes(request.auth!.userId);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
