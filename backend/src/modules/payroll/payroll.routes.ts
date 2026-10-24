import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createOrRecalculateDraft,
  finalizePayrollRun,
  getPayrollRunPayslips,
  listPayrollRuns,
  renderPayslipPdf,
} from "./payroll.service.js";
import { payrollDraftSchema, payrollListQuerySchema, payrollRunIdParamSchema, payslipIdParamSchema } from "./payroll.schemas.js";

const router = Router();

router.post("/runs/draft", requireAuth, validate(payrollDraftSchema), async (request, response, next) => {
  try {
    response.status(201).json(await createOrRecalculateDraft(request.auth!, request.body));
  } catch (error) {
    next(error);
  }
});

router.post("/runs/:id/finalize", requireAuth, validate(payrollRunIdParamSchema), async (request, response, next) => {
  try {
    response.json(await finalizePayrollRun(request.auth!, String(request.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get("/runs", requireAuth, validate(payrollListQuerySchema), async (request, response, next) => {
  try {
    const parsed = payrollListQuerySchema.parse({ query: request.query });
    response.json(await listPayrollRuns(request.auth!, parsed.query));
  } catch (error) {
    next(error);
  }
});

router.get("/runs/:id/payslips", requireAuth, validate(payrollRunIdParamSchema), async (request, response, next) => {
  try {
    response.json(await getPayrollRunPayslips(request.auth!, String(request.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get("/payslips/:id/pdf", requireAuth, validate(payslipIdParamSchema), async (request, response, next) => {
  try {
    const pdf = await renderPayslipPdf(request.auth!, String(request.params.id));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename=\"payslip-${String(request.params.id)}.pdf\"`);
    response.send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;
