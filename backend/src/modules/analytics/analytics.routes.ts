import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getAdminDashboard, getEmployeeDashboard, getHrDashboard } from "./analytics.service.js";
import { analyticsQuerySchema } from "./analytics.schemas.js";

const router = Router();

router.get("/hr-dashboard", requireAuth, validate(analyticsQuerySchema), async (request, response, next) => {
  try {
    const parsed = analyticsQuerySchema.parse({ query: request.query });
    response.json(await getHrDashboard(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

router.get("/admin-dashboard", requireAuth, validate(analyticsQuerySchema), async (request, response, next) => {
  try {
    const parsed = analyticsQuerySchema.parse({ query: request.query });
    response.json(await getAdminDashboard(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

router.get("/employee-dashboard", requireAuth, async (request, response, next) => {
  try {
    response.json(await getEmployeeDashboard(request.auth!));
  } catch (error) {
    next(error);
  }
});

export default router;
