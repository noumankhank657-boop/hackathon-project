# HCM Lite — Project Context (READ THIS FIRST)

This file is the memory of the project. Any AI tool that opens this repo must read this file, then `TASKS.md`, then `DECISIONS.md`, and look at the real code before doing anything.

The original brief is in `docs/HCM_Lite_Brief.pdf`. If this file and the PDF disagree, the PDF wins.

---

## 1. What we are building

**HCM Lite**: a web-based Human Capital Management system with an AI assistant, for Admin, HR and Employees.

- Event: Saylani Hackathon, 24 Oct 2026, Zaitoon Ashraf IT Park.
- **No dummy data.** The app starts empty. Admin sets up the company, HR registers employees, and every number comes from what people do in the app. Do NOT write seed scripts that fill fake employees.
- Judges start from a fresh install, create the company, a few employees and their activity, then check that dashboards and AI answers match those records.
- 9 modules, 25 functionalities. Web app is required.
- **Our extra goal: camera attendance with face detection + location (and face matching + blink check).** This is treated as a main feature, not an afterthought. See section 6 and Phase 9 in `TASKS.md`.

Modules: M1 Auth & Access · M2 Organization Setup · M3 Employees · M4 Attendance · M5 Leave · M6 Payroll Lite · M7 Dashboards & Analytics · M8 AI Assistant · M9 Comms & Audit.

## 2. Roles and permissions

Access is checked **on the server for every request**. Hiding a button is not enough. The AI assistant works with the same access as the person using it.

**Admin (company level)**
- Company setup: name, office hours, grace time, weekend, office location + radius.
- Departments, designations, leave types + yearly quotas, public holidays.
- Create HR logins; deactivate or reset any login.
- View every employee, attendance, leave and payroll record.
- **Finalize** monthly payroll (only Admin can lock it).
- Company dashboard, audit log, announcements, AI on all company data.
- CANNOT: edit a payroll run after it is finalized; delete or change audit log entries.

**HR (people operations)**
- Register employees (this creates their login), edit details, CSV import/export.
- Set salary structures. Daily attendance board. Approve/reject attendance corrections.
- Approve/reject leave with a comment. Create and review the payroll draft.
- HR dashboard + insights. AI on HR data. Post announcements.
- CANNOT: change company settings/rules/office location; create Admin users; finalize payroll; view the audit log.

**Employee (self-service)**
- Check in / check out. Own attendance calendar; request a correction with a reason.
- Apply for / cancel leave, see balance, smart leave in plain words.
- Download own payslips. View own profile; edit phone and address only.
- Personal dashboard. AI on own data + company policy. Read announcements and notifications.
- CANNOT: see any other employee's data or salary; approve anything; edit own salary, role or attendance directly.

**First run:** a fresh install asks for the company name and the Admin account (or reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the env file). Admin then creates HR logins. HR registering an employee creates that employee's login with a **temporary password that must be changed on first sign-in**.

## 3. Business rules (these decide whether it works)

**M1 Auth**: JWT login, bcrypt passwords. Every API checks role AND data scope: an Employee only reads rows with their own `employee_id`.

**M2 Setup**: office start 09:00, grace 15 min, half day under 5 h, weekend Sat–Sun, office location + radius (example 150 m). Stored as settings; applied to NEW records only.

**M3 Employees**: HR registers each employee with job details and salary; this creates the login. Server-side search, filters, paging. Optional CSV import has a **dry run** that returns row + field + reason; checks: required fields, unique code/email, valid email, known department, ISO date, salary > 0.

**M4 Attendance**: the **server** stamps the time (never trust the client clock). One record per employee per day (second check-in = HTTP 409). Late after 09:15; `half_day` if worked under 5 h; `absent` if no record and no approved leave; `missing_checkout` if no check-out.

**M5 Leave**: working days only (skip weekends and holidays). Quotas per year: annual 14, sick 8, casual 10; unpaid unlimited. Overlap or over-balance = HTTP 422.

**M6 Payroll**:
- Gross = 1.5 × basic (HRA 40% of basic, medical 10% of basic).
- Per day = gross ÷ working days in the month.
- Deduct: absent days + unpaid leave days + 0.5 × half days.
- Prorate joiners and leavers.
- Tax is on annual gross (gross × 12), then divide by 12 for the month:
  - up to 600,000 → 0
  - 600,000–1,200,000 → 5% of the amount above 600,000
  - 1,200,000–2,400,000 → 30,000 + 15% of the amount above 1,200,000
  - 2,400,000–3,600,000 → 210,000 + 25% of the amount above 2,400,000
  - above 3,600,000 → 510,000 + 35% of the amount above 3,600,000
- Admin finalizes; finalized runs are locked (no edits).

**M7 Dashboards**: all numbers computed on the server (database aggregation), filterable by date range and department.

**M9 Comms & Audit**: announcements on all dashboards, in-app notifications, audit log with actor, action, entity, before/after JSON.

## 4. Metrics (formulas)

| Metric | Formula |
|---|---|
| Headcount | Active + probation on the end date |
| Attrition | Exits in period ÷ average headcount × 100 |
| Attendance rate | (present + late + missing_checkout + 0.5 × half_day) ÷ (working-day records − on_leave) |
| Late % | late ÷ (present + late), per department |
| Absenteeism | absent days ÷ expected working days, per department |
| Leave utilization | approved days ÷ quota, per leave type and department |
| Payroll cost | sum of gross and net by month and department |
| Average salary | mean gross by department and designation |

Dashboards:
- **HR**: headcount, present, on leave, late today, pending approvals · attendance trend · absenteeism by dept · leave by type · top 5 late-comers · AI summary.
- **Admin**: headcount, attrition YTD, payroll cost, avg salary · headcount by dept · payroll cost by dept · gender and tenure · audit feed · AI summary.
- **Employee**: check-in widget · hours this week vs 40 h · late count · leave balance · last payslip · announcements · ask my assistant.

## 5. AI Assistant rules (M8)

- Any hosted LLM API with **tool calling**. The database is the only source of truth.
- Chat: `POST /ai/chat`. The model picks a tool, the backend runs it **with the user's scope**, the model writes the answer.
- Tools: `get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`.
- Dashboard summary (Admin, HR): send the KPI JSON for the current filters, get 3–5 bullets using ONLY those numbers.
- Smart leave (Employee): "Need next Monday and Tuesday off for a wedding" → JSON `{type, start, end, reason}` → pre-filled form. The user confirms.
- Policy Q&A (all roles): rules from section 3 go in the system prompt; the model answers only from them or says it does not know.
- Guardrails:
  - API key only in backend env `AI_API_KEY`. The browser NEVER calls the AI provider.
  - The model never touches the database. Tools reuse the same services and permission checks as the REST API.
  - The AI never saves data on its own. Validate JSON output; on failure retry once, then show the normal form.
  - 15 s timeout with a friendly fallback, about 20 requests per user per hour, every call logged in `ai_logs`. Answers carry an "AI-generated" label.
- Judges will test: HR "how many active employees in {dept}", "who came late most often this month", "this month's attendance rate" (must equal the dashboard); Employee "how many sick leaves do I have left" (own balance); Employee "what is {colleague}'s salary" (politely refuse); Employee "I need next Monday and Tuesday off for my sister's wedding" (pre-filled casual leave, correct dates).
- Bonus: AI understands Roman Urdu.

## 6. Face attendance rules (our main extra feature)

Flow: open front camera → detect face (exactly one) → get GPS (lat, lng, accuracy) → send to server → server checks → saved with `source = camera`.

- Reject the check-in if: no face, more than one face, location outside the office radius, or GPS accuracy worse than 100 m.
- The **server** calculates the distance (Haversine, or `geolib` `isPointWithinRadius`) and decides. The client only sends data. Admin sets office lat/lng and radius.
- Time is set by the server.
- Store the **result**, not the full photo. Tell users what is captured.
- If the check fails, the employee falls back to an HR attendance correction.
- Extra bonus: face matching against the employee's enrolled face (128-number face descriptors) + a simple liveness check (blink).
- Libraries (free): web → `@vladmandic/face-api` (detection, landmarks, descriptors) or `@mediapipe/tasks-vision`; browser Geolocation API; server → `geolib`.
- Honest limit to write in the README: matching happens in the browser, so a determined attacker could fake the descriptor. This is acceptable for a hackathon demo.

## 7. Tech stack (current decision; change it in DECISIONS.md if you change it)

- Backend: Node.js + TypeScript + Express, Prisma ORM, PostgreSQL (free hosted Postgres such as Neon or Supabase), `bcrypt`, `jsonwebtoken`, `zod` for validation, `pdfkit` for payslip PDF, `geolib`.
- Frontend: React + Vite + TypeScript + Tailwind, React Router, a small charts library (Recharts), `@vladmandic/face-api`. Must work from 375 px width.
- AI: any provider with an OpenAI-compatible chat API and tool calling (for example Groq, OpenRouter free models, or Gemini). Keep provider, base URL and model in env variables so the provider can be swapped if free credits run out.
- Hosting: frontend on Vercel or Netlify; backend on Render (free tier sleeps, wake it before the demo); database on Neon or Supabase.
- Tests: a few unit tests for the rules in services (attendance status, leave days, payroll, tax slab).

## 8. Folder structure

```
hackathon-project/
  PROJECT.md  TASKS.md  DECISIONS.md  README.md  .env.example  .gitignore
  docs/HCM_Lite_Brief.pdf
  backend/
    prisma/schema.prisma
    src/
      modules/<auth|org|employees|attendance|leave|payroll|analytics|ai|comms>/
        <name>.routes.ts  <name>.service.ts  <name>.schemas.ts
      middleware/ (auth, role guard, scope guard, error handler)
      lib/ (db client, audit helper, jwt, ai client)
      server.ts
    tests/
  frontend/
    src/ (pages, components, api client, auth context, hooks, face/)
```

## 9. Rules for the AI tool (obey these)

1. **Inspect first.** Read this file, TASKS.md, DECISIONS.md, then look at the real code and git log. Never assume what exists.
2. **Do not rewrite working code.** Extend it. If something must change, say what and why.
3. **Rules live in services**, not in routes or React components. Routes only validate input, call a service, return JSON.
4. **Validate every input** with zod. Return clear errors: 400 bad input, 401 not logged in, 403 wrong role/scope, 409 duplicate, 422 rule broken.
5. **Check role AND data scope on the server** for every endpoint.
6. **Audit log** every create, update, approve and finalize action (actor, action, entity, before JSON, after JSON).
7. **No dummy data. No secrets in git.** Only `.env.example` is committed.
8. **Every screen needs loading, empty and error states.**
9. **Small steps.** After each working piece: run it, test it, then commit with a clear message.
10. **Tell the truth.** Do not say something works unless you ran it. List what is done and what is not.
11. At the end of every work session, update the status table in `TASKS.md` and add any new decision to `DECISIONS.md`.

## 10. Resume prompt (paste this into any IDE chat, fill the blanks)

```
Read PROJECT.md, TASKS.md and DECISIONS.md in this repo, and docs/HCM_Lite_Brief.pdf if you can open it.
Then inspect the existing code and the git log to see what is really built.

I was working with another tool and it stopped (credits ended). 
CURRENT PHASE: Phase __ (status: done / half done / broken)
WHAT WORKS: ...
WHAT IS BROKEN OR MISSING: ...
TARGET: finish Phase __ and, if time allows, continue to Phase __.

First tell me in plain words what you found in the code and what you will do. 
Then do ONE task at a time. After each task tell me: what you changed, which files, and how I can check it.
Follow the rules in PROJECT.md section 9. When done, update the status table in TASKS.md.
```
