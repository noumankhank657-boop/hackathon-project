import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  approveCorrection,
  checkIn,
  checkOut,
  getAttendanceCalendar,
  getDailyBoard,
  listCorrections,
  rejectCorrection,
  requestAttendanceCorrection,
} from "./attendance.service.js";
import {
  boardQuerySchema,
  calendarQuerySchema,
  checkInSchema,
  checkOutSchema,
  correctionDecisionSchema,
  correctionListQuerySchema,
  correctionSchema,
} from "./attendance.schemas.js";

const router = Router();

router.post("/check-in", requireAuth, validate(checkInSchema), async (request, response, next) => {
  try {
    response.status(201).json(await checkIn(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/check-out", requireAuth, validate(checkOutSchema), async (request, response, next) => {
  try {
    response.json(await checkOut(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.get("/calendar", requireAuth, validate(calendarQuerySchema), async (request, response, next) => {
  try {
    const parsed = calendarQuerySchema.parse({ query: request.query });
    response.json(await getAttendanceCalendar(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

router.get("/board", requireAuth, validate(boardQuerySchema), async (request, response, next) => {
  try {
    const parsed = boardQuerySchema.parse({ query: request.query });
    response.json(await getDailyBoard(request.auth!, parsed.query.date));
  } catch (error) {
    next(error);
  }
});

router.post("/corrections", requireAuth, validate(correctionSchema), async (request, response, next) => {
  try {
    response.status(201).json(await requestAttendanceCorrection(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.get("/corrections", requireAuth, validate(correctionListQuerySchema), async (request, response, next) => {
  try {
    const parsed = correctionListQuerySchema.parse({ query: request.query });
    response.json(await listCorrections(request.auth!, parsed.query.status));
  } catch (error) {
    next(error);
  }
});

router.post("/corrections/:id/approve", requireAuth, validate(correctionDecisionSchema), async (request, response, next) => {
  try {
    response.json(await approveCorrection(request.auth!, String(request.params.id), request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/corrections/:id/reject", requireAuth, validate(correctionDecisionSchema), async (request, response, next) => {
  try {
    response.json(await rejectCorrection(request.auth!, String(request.params.id), request.body.comment));
  } catch (error) {
    next(error);
  }
});

export default router;
