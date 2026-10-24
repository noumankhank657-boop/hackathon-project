import { db } from "../../lib/db.js";
import { AppError } from "../../middleware/error-handler.js";
import type { TokenPayload } from "../../lib/jwt.js";
import { getAdminDashboard, getHrDashboard } from "../analytics/analytics.service.js";
import { listEmployees } from "../employees/employees.service.js";
import { getLeaveBalances } from "../leave/leave.service.js";

const policyRules = `
Business rules:
- Attendance uses server time. Late after office start + grace. Half day under 5h.
- Leave quotas yearly: annual 14, sick 8, casual 10, unpaid unlimited.
- Payroll gross = 1.5 x basic. Tax slabs are applied on annual gross then divided by 12.
- Employees can only access their own data and must not receive colleague salary details.
If unsure, say you don't know.
`;

const aiConfig = () => {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;
  if (!apiKey || !baseUrl || !model) throw new AppError(500, "AI environment is not configured");
  return { apiKey, baseUrl, model };
};

async function withRateLimit(auth: TokenPayload) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await db.aiLog.count({ where: { userId: auth.userId, createdAt: { gte: hourAgo } } });
  if (count >= 20) throw new AppError(429, "AI rate limit reached. Please try again in a while.");
}

async function logAiCall(auth: TokenPayload, prompt: string, response?: string) {
  await db.aiLog.create({ data: { userId: auth.userId, prompt, response } });
}

async function runAiRequest(body: Record<string, unknown>) {
  const { apiKey, baseUrl } = aiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new AppError(502, `AI provider error: ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function runTool(auth: TokenPayload, toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case "get_headcount": {
      const count = await db.employee.count({
        where: { status: { in: ["ACTIVE", "PROBATION"] }, departmentId: (args.departmentId as string | undefined) ?? undefined },
      });
      return { count };
    }
    case "get_attendance_summary": {
      const from = (args.from as string | undefined) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const to = (args.to as string | undefined) ?? new Date().toISOString().slice(0, 10);
      return auth.role === "ADMIN"
        ? getAdminDashboard(auth, { from, to, departmentId: args.departmentId as string | undefined })
        : getHrDashboard(auth, { from, to, departmentId: args.departmentId as string | undefined });
    }
    case "get_late_comers": {
      const from = new Date((args.from as string) ?? new Date().toISOString().slice(0, 10));
      const to = new Date((args.to as string) ?? new Date().toISOString().slice(0, 10));
      to.setHours(23, 59, 59, 999);
      const limit = Number(args.limit ?? 5);
      const rows = await db.attendance.groupBy({
        by: ["employeeId"],
        where: { date: { gte: from, lte: to }, status: "LATE" },
        _count: { employeeId: true },
        orderBy: { _count: { employeeId: "desc" } },
        take: limit,
      });
      const employees = await db.employee.findMany({ where: { id: { in: rows.map((item) => item.employeeId) } } });
      return rows.map((row) => ({
        employeeId: row.employeeId,
        name: `${employees.find((item) => item.id === row.employeeId)?.firstName ?? ""} ${employees.find((item) => item.id === row.employeeId)?.lastName ?? ""}`.trim(),
        lateCount: row._count.employeeId,
      }));
    }
    case "get_leave_summary": {
      const from = (args.from as string) ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const to = (args.to as string) ?? new Date().toISOString().slice(0, 10);
      const leaves = await db.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: new Date(to) },
          endDate: { gte: new Date(from) },
        },
        include: { leaveType: true },
      });
      const summary = new Map<string, number>();
      leaves.forEach((leave) => {
        summary.set(leave.leaveType.name, (summary.get(leave.leaveType.name) ?? 0) + Number(leave.days));
      });
      return Array.from(summary.entries()).map(([type, days]) => ({ type, days }));
    }
    case "get_my_leave_balance": {
      if (auth.role !== "EMPLOYEE" || !auth.employeeId) throw new AppError(403, "Only employees can access leave balance");
      return getLeaveBalances(auth, auth.employeeId, args.year ? Number(args.year) : undefined);
    }
    case "get_payroll_summary": {
      const month = Number(args.month);
      const year = Number(args.year);
      const run = await db.payrollRun.findUnique({
        where: { month_year: { month, year } },
        include: { payslips: { include: { employee: { include: { department: true } } } } },
      });
      if (!run) return { message: "No payroll run found for that month" };
      if (auth.role === "EMPLOYEE") {
        const own = run.payslips.find((item) => item.employeeId === auth.employeeId);
        return own ? { gross: own.gross, net: own.net, tax: own.tax } : { message: "No payslip found" };
      }
      const totalGross = run.payslips.reduce((sum, item) => sum + Number(item.gross), 0);
      const totalNet = run.payslips.reduce((sum, item) => sum + Number(item.net), 0);
      return { month, year, totalGross, totalNet, employees: run.payslips.length };
    }
    case "search_employees": {
      if (auth.role === "EMPLOYEE") throw new AppError(403, "Employees cannot search directory");
      const query = String(args.query ?? "");
      return listEmployees(auth, { page: 1, pageSize: 20, search: query, departmentId: undefined, status: undefined });
    }
    default:
      throw new AppError(422, `Unknown tool: ${toolName}`);
  }
}

const aiTools = [
  { type: "function", function: { name: "get_headcount", description: "Get active headcount", parameters: { type: "object", properties: { departmentId: { type: "string" } } } } },
  { type: "function", function: { name: "get_attendance_summary", description: "Attendance summary by range", parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, departmentId: { type: "string" } } } } },
  { type: "function", function: { name: "get_late_comers", description: "Top late comers", parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_leave_summary", description: "Leave summary", parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } } } },
  { type: "function", function: { name: "get_my_leave_balance", description: "Current employee leave balance", parameters: { type: "object", properties: { year: { type: "number" } } } } },
  { type: "function", function: { name: "get_payroll_summary", description: "Payroll summary", parameters: { type: "object", properties: { month: { type: "number" }, year: { type: "number" } }, required: ["month", "year"] } } },
  { type: "function", function: { name: "search_employees", description: "Search employee directory", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
];

export async function chatWithAi(auth: TokenPayload, payload: { message: string; from?: string; to?: string; departmentId?: string }) {
  await withRateLimit(auth);
  if (auth.role === "EMPLOYEE" && /salary|pay of|colleague|other employee/i.test(payload.message)) {
    const refusal = "I can only help with your own records. I cannot share another employee's salary details.";
    await logAiCall(auth, payload.message, refusal);
    return { text: refusal, aiGenerated: true };
  }

  const { model } = aiConfig();
  const messages = [
    { role: "system", content: `${policyRules}\nUse tools for data answers and include only authorized scope.` },
    { role: "user", content: payload.message },
  ];

  try {
    const first = await runAiRequest({ model, messages, tools: aiTools, tool_choice: "auto" });
    const firstChoice = first.choices?.[0]?.message;
    const toolCall = firstChoice?.tool_calls?.[0];
    let finalText = firstChoice?.content ?? "";

    if (toolCall?.function?.name) {
      const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
      const toolResult = await runTool(auth, toolCall.function.name, args);
      const second = await runAiRequest({
        model,
        messages: [
          ...messages,
          firstChoice,
          { role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolResult) },
        ],
      });
      finalText = second.choices?.[0]?.message?.content ?? "I could not generate a response.";
    }

    await logAiCall(auth, payload.message, finalText);
    return { text: finalText, aiGenerated: true };
  } catch (error) {
    const fallback = "AI is taking longer than expected right now. Please try again in a moment.";
    await logAiCall(auth, payload.message, `fallback:${error instanceof Error ? error.message : "unknown"}`);
    return { text: fallback, aiGenerated: true };
  }
}

export async function summarizeKpis(auth: TokenPayload, payload: { kpis: Record<string, unknown>; context?: string }) {
  await withRateLimit(auth);
  if (auth.role === "EMPLOYEE") throw new AppError(403, "Only Admin and HR can summarize dashboard KPIs");
  const { model } = aiConfig();
  const prompt = `Summarize these KPI numbers in 3-5 short bullets. Use only given values.\nContext: ${payload.context ?? "dashboard"}\nKPIs: ${JSON.stringify(payload.kpis)}`;
  try {
    const response = await runAiRequest({
      model,
      messages: [{ role: "system", content: "Respond with concise bullets and do not invent numbers." }, { role: "user", content: prompt }],
    });
    const text = response.choices?.[0]?.message?.content ?? "";
    await logAiCall(auth, prompt, text);
    return { text, aiGenerated: true };
  } catch (error) {
    await logAiCall(auth, prompt, `fallback:${error instanceof Error ? error.message : "unknown"}`);
    return { text: "AI summary is unavailable right now. Please try again shortly.", aiGenerated: true };
  }
}

export async function smartLeave(auth: TokenPayload, payload: { text: string }) {
  if (auth.role !== "EMPLOYEE") throw new AppError(403, "Only employees can use smart leave");
  await withRateLimit(auth);
  const { model } = aiConfig();
  const today = new Date().toISOString().slice(0, 10);
  const instruction = `Today is ${today}. Convert the sentence into leave JSON {type,start,end,reason}. Return JSON only.`;
  const schema = {
    type: "object",
    properties: {
      type: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      reason: { type: "string" },
    },
    required: ["type", "start", "end", "reason"],
  };

  const attempt = async () => {
    const response = await runAiRequest({
      model,
      messages: [{ role: "system", content: instruction }, { role: "user", content: payload.text }],
      response_format: { type: "json_schema", json_schema: { name: "leave_request", schema } },
    });
    const content = response.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { type: string; start: string; end: string; reason: string };
    if (!parsed.type || !parsed.start || !parsed.end || !parsed.reason) throw new Error("invalid smart leave payload");
    return parsed;
  };

  try {
    const first = await attempt();
    await logAiCall(auth, payload.text, JSON.stringify(first));
    return { ...first, aiGenerated: true };
  } catch {
    try {
      const second = await attempt();
      await logAiCall(auth, payload.text, JSON.stringify(second));
      return { ...second, aiGenerated: true };
    } catch {
      await logAiCall(auth, payload.text, "smart-leave-fallback");
      return {
        type: "",
        start: "",
        end: "",
        reason: payload.text,
        aiGenerated: true,
        fallback: true,
      };
    }
  }
}

export async function verifyToolCalling() {
  const { model } = aiConfig();
  const response = await runAiRequest({
    model,
    messages: [{ role: "user", content: "Use tool get_headcount for departmentId 'demo'." }],
    tools: aiTools,
    tool_choice: "auto",
  });
  return response.choices?.[0]?.message?.tool_calls?.length ? { ok: true } : { ok: false, error: "No tool_calls returned by model" };
}
