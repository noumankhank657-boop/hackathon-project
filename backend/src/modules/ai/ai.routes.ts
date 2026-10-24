import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { aiChatSchema, aiSummarizeSchema, smartLeaveSchema } from "./ai.schemas.js";
import { chatWithAi, smartLeave, summarizeKpis, verifyToolCalling } from "./ai.service.js";

const router = Router();

router.post("/chat", requireAuth, validate(aiChatSchema), async (request, response, next) => {
  try {
    response.json(await chatWithAi(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/summarize", requireAuth, validate(aiSummarizeSchema), async (request, response, next) => {
  try {
    response.json(await summarizeKpis(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/smart-leave", requireAuth, validate(smartLeaveSchema), async (request, response, next) => {
  try {
    response.json(await smartLeave(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.get("/tooling-check", requireAuth, async (_request, response, next) => {
  try {
    response.json(await verifyToolCalling());
  } catch (error) {
    next(error);
  }
});

export default router;
