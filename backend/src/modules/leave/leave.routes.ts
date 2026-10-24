import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  applyLeaveSchema,
  employeeIdSchema,
  leaveCancelSchema,
  leaveDecisionSchema,
  leaveListSchema,
} from "./leave.schemas.js";
import { applyLeave, approveLeave, cancelLeave, getLeaveBalances, listLeaveRequests, rejectLeave } from "./leave.service.js";

const router = Router();

router.post("/requests", requireAuth, validate(applyLeaveSchema), async (request, response, next) => {
  try {
    response.status(201).json(await applyLeave(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:id/cancel", requireAuth, validate(leaveCancelSchema), async (request, response, next) => {
  try {
    response.json(await cancelLeave(request.auth!, String(request.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get("/requests", requireAuth, validate(leaveListSchema), async (request, response, next) => {
  try {
    const parsed = leaveListSchema.parse({ query: request.query });
    response.json(await listLeaveRequests(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

router.get("/balance/me", requireAuth, async (request, response, next) => {
  try {
    if (!request.auth?.employeeId) {
      response.status(403).json({ error: "Employee profile not available" });
      return;
    }
    const year = Number(request.query.year) || undefined;
    response.json(await getLeaveBalances(request.auth, request.auth.employeeId, year));
  } catch (error) {
    next(error);
  }
});

router.get("/balance/:employeeId", requireAuth, validate(employeeIdSchema), async (request, response, next) => {
  try {
    const parsed = employeeIdSchema.parse({ params: request.params, query: request.query });
    response.json(await getLeaveBalances(request.auth!, parsed.params.employeeId, parsed.query.year));
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:id/approve", requireAuth, validate(leaveDecisionSchema), async (request, response, next) => {
  try {
    response.json(await approveLeave(request.auth!, String(request.params.id), request.body.comment));
  } catch (error) {
    next(error);
  }
});

router.post("/requests/:id/reject", requireAuth, validate(leaveDecisionSchema), async (request, response, next) => {
  try {
    response.json(await rejectLeave(request.auth!, String(request.params.id), request.body.comment));
  } catch (error) {
    next(error);
  }
});

export default router;
