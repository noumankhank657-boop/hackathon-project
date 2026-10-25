# HCM Lite — Project Summary and Reviewer Guide

## Quick summary

HCM Lite is a browser-based human-resources app for one company. Admin configures the company, HR manages employees and approvals, and Employees use their own attendance, leave, profile, and payslip screens. The app includes an AI assistant and an optional camera attendance flow.

The stack is React, Vite, TypeScript, Tailwind, React Router and Recharts in the browser; Node.js, Express, TypeScript, Prisma and PostgreSQL on the server; PDFKit for payslip PDFs; and DeepSeek through its OpenAI-compatible API for AI. An API is the set of web addresses the browser calls to ask the server to read or change data. Prisma is the database mapper: it connects the TypeScript models to PostgreSQL tables.

The core screens and routes are present for setup, login, organization settings, employees, attendance, leave, payroll, dashboards, announcements, notifications, audit, AI and face attendance. Dashboard KPI means “key performance indicator,” a measured business number such as headcount. The three rule test files contain six tests. Backend and frontend builds and those unit tests passed in the verification run recorded during this work.

Important limits: the configured development database already had records from earlier API smoke checks, so the five-minute demo was not rerun on a fresh database. The webcam and physical GPS were not tested. The HR/Admin dashboard does not have gender data to chart. Some dashboard formulas and payroll edge cases do not yet match the brief exactly. A few AI tools expose cross-company information to Employee role, and the employee-salary refusal is a text-pattern check rather than a complete policy enforcement layer. Read “Known gaps and risks” before presenting the app.

No deployment was done. The honest face-attendance limit is that the browser generates the face descriptor and blink result; a determined user can spoof those browser inputs even though the server checks the descriptor distance and GPS radius.

---

## 1. One-paragraph pitch

HCM Lite helps a company keep employee information, attendance, leave approvals, payroll and internal updates in one place. Admin configures company rules and controls access; HR registers employees and runs people operations; Employees check in, request leave, update limited contact details and download their payslips. Dashboards read from the company database, and an AI assistant can explain selected business data and policy. Camera attendance is an additional demo feature, not a production identity-security system.

## 2. What the app contains

The status labels below describe what is present in the code, not what has been independently tested in a fresh browser session:

- **DONE** — the main flow exists in code.
- **PARTIAL** — a flow exists, but an important part is missing, inaccurate or not tested.
- **NOT DONE** — no working implementation was found.

There are no items marked NOT DONE among the 25 checklist entries because each has at least a partial implementation. This does not mean every item is complete.

### M1 — Auth and access

- **Built:** first-run Admin setup; login; change-password screen; forced password change for temporary-password users; role-aware menus and route guards. Logout removes the saved browser token; there is no server logout endpoint.
- **Main screens:** `/setup`, `/login`, `/change-password`, and the role-specific dashboard at `/`.
- **Main API endpoints:** `GET /auth/setup-status`, `POST /auth/setup`, `POST /auth/login`, `POST /auth/change-password`.
- **PDF checklist:** **01 DONE**, **02 DONE**. The server checks the current account on each authenticated request; the browser menu is not the security boundary.
- **Code:** [AuthPages.tsx](../frontend/src/pages/AuthPages.tsx), [AuthContext.tsx](../frontend/src/auth/AuthContext.tsx), [auth.routes.ts](../backend/src/modules/auth/auth.routes.ts), [auth.service.ts](../backend/src/modules/auth/auth.service.ts).

### M2 — Organization setup

- **Built:** Admin can edit office start, grace, half-day threshold, weekend, coordinates and radius; manage departments, designations, leave types and holidays; create HR logins and activate/deactivate or reset accounts by user ID. HR can view settings and organization lists.
- **Main screens:** `/organization` and Admin-only `/users`.
- **Main API endpoints:** `GET/PUT /org/settings`; `GET/POST/PUT/DELETE /org/departments`; equivalent paths for `/org/designations`, `/org/leave-types` and `/org/holidays`; `GET/POST /org/hr-users`; `PATCH /org/users/:id`; `POST /org/users/:id/reset-password`; `POST /org/bootstrap-default-leaves`.
- **PDF checklist:** **03 DONE**, **04 DONE**, **05 PARTIAL**. The management screen lists HR accounts only, not every employee login. The backend activation/reset routes accept a user ID, but the user-management screen does not provide employee-account controls. Standard annual/sick/casual/unpaid types are created only when Admin chooses the bootstrap action; they are not automatically inserted on setup.
- **Code:** [OrganizationPage.tsx](../frontend/src/pages/OrganizationPage.tsx), [UsersPage.tsx](../frontend/src/pages/UsersPage.tsx), [org.routes.ts](../backend/src/modules/org/org.routes.ts), [org.service.ts](../backend/src/modules/org/org.service.ts).

### M3 — Employees

- **Built:** registration creates an Employee and login, returns a temporary password, and requires a password change on first login. HR/Admin can edit job details; an Employee can edit only their phone and address. Search, department/status filters, paging, CSV dry-run/confirm/export and an Employee profile page exist.
- **Main screens:** `/employees`, `/employees/new`, `/employees/:id`, `/employees/:id/edit`, `/employees/import`, `/profile`.
- **Main API endpoints:** `POST/GET /employees`; `GET /employees/me`; `PATCH /employees/me`; `GET/PATCH /employees/:id`; `GET /employees/export/csv`; `POST /employees/import/csv/dry-run`; `POST /employees/import/csv/confirm`.
- **PDF checklist:** **06 PARTIAL**, **07 PARTIAL**, **08 PARTIAL**. The profile shows employee, job, account and compensation fields, but does not bring together attendance, leave and payroll history as a full activity 360. The API/UI allow Admin to create and edit employees even though the PDF access matrix says Admin should view them. The CSV parser splits on commas and lines rather than implementing the full quoted-CSV format; duplicate codes/emails inside the same file are not detected during dry-run. Confirmed rows are created sequentially, not in one transaction, and Admin can use CSV import/export although the PDF assigns CSV management to HR.
- **Code:** [EmployeeFormPage.tsx](../frontend/src/pages/EmployeeFormPage.tsx), [EmployeeDirectoryPage.tsx](../frontend/src/pages/EmployeeDirectoryPage.tsx), [EmployeeProfilePage.tsx](../frontend/src/pages/EmployeeProfilePage.tsx), [CsvImportPage.tsx](../frontend/src/pages/CsvImportPage.tsx), [employees.service.ts](../backend/src/modules/employees/employees.service.ts).

### M4 — Attendance

- **Built:** Employee web check-in/out uses server time; calendar; HR/Admin daily board; correction request and approval/rejection; camera enrollment/check-in screens.
- **Main screens:** `/attendance`, `/attendance/board`, `/attendance/corrections`, `/face/register`, `/face/check-in`.
- **Main API endpoints:** `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance/calendar`, `GET /attendance/board`, `GET/POST /attendance/corrections`, `POST /attendance/corrections/:id/approve`, `POST /attendance/corrections/:id/reject`.
- **PDF checklist:** **09 PARTIAL**, **10 PARTIAL**, **11 DONE**. Web check-in/out is restricted to `EMPLOYEE`; the PDF access matrix also lists HR as having own check-in/out. The calendar adds virtual on-leave rows, but no service/job creates `ABSENT` records for employees who did not check in. The daily board lists stored attendance records only. The `MISSING_CHECKOUT` enum exists, but no scheduled process changes a record to that status automatically.
- **Code:** [AttendancePage.tsx](../frontend/src/pages/AttendancePage.tsx), [AttendanceCorrectionsPage.tsx](../frontend/src/pages/AttendanceCorrectionsPage.tsx), [attendance.engine.ts](../backend/src/modules/attendance/attendance.engine.ts), [attendance.service.ts](../backend/src/modules/attendance/attendance.service.ts).

### M5 — Leave

- **Built:** Employees apply, cancel eligible requests, view their balance/history, and can ask AI to prefill a leave form. Admin/HR approve or reject with a comment. Decisions create employee notifications and audit entries.
- **Main screen:** `/leave`.
- **Main API endpoints:** `POST/GET /leave/requests`; `POST /leave/requests/:id/cancel`; `GET /leave/balance/me`; `GET /leave/balance/:employeeId`; `POST /leave/requests/:id/approve`; `POST /leave/requests/:id/reject`.
- **PDF checklist:** **12 PARTIAL**, **13 PARTIAL**. Working days skip configured weekend days and holidays. Balance counts approved requests only, so pending requests do not reserve quota. The balance query groups requests by their start date; a leave request spanning two calendar years is not split accurately across both yearly balances. Apply/cancel is Employee-only, while the PDF matrix lists HR with own leave access. Admin can approve/reject in the API/UI, while the PDF matrix lists Admin as view-only.
- **Code:** [LeavePage.tsx](../frontend/src/pages/LeavePage.tsx), [leave.rules.ts](../backend/src/modules/leave/leave.rules.ts), [leave.service.ts](../backend/src/modules/leave/leave.service.ts).

### M6 — Payroll Lite

- **Built:** HR can edit basic salary, create/recalculate a monthly draft and review payslips. Admin can finalize and lock a run. Payslip PDFs are generated by the backend.
- **Main screen:** `/payroll`.
- **Main API endpoints:** `POST /payroll/runs/draft`; `GET /payroll/runs`; `GET /payroll/runs/:id/payslips`; `POST /payroll/runs/:id/finalize`; `GET /payroll/payslips/:id/pdf`.
- **PDF checklist:** **14 PARTIAL**, **15 PARTIAL**, **16 DONE**, **17 PARTIAL**. Allowances are fixed by the formula rather than editable fields. The employee edit screen lets Admin edit salary, and the draft service allows Admin to create drafts even though the PDF matrix lists Admin as view-only for those functions. Payroll calculates attendance deductions, but it does not prorate gross pay for joiners/leavers as the brief requires. A finalized run cannot be recalculated through the draft route (409). However, the payslip/PDF service does not check that the run is finalized, so a user who obtains a draft payslip ID may fetch it directly; the UI hides draft PDF buttons but that is not server protection.
- **Code:** [PayrollPage.tsx](../frontend/src/pages/PayrollPage.tsx), [payroll.rules.ts](../backend/src/modules/payroll/payroll.rules.ts), [payroll.service.ts](../backend/src/modules/payroll/payroll.service.ts).

### M7 — Dashboards and analytics

- **Built:** Admin, HR and Employee dashboard pages with KPI cards, charts and filters where provided by the API. HR attendance trend was changed to daily counts in the analytics service so the chart does not count raw attendance records in the browser.
- **Main screen:** `/` (dashboard varies by role).
- **Main API endpoints:** `GET /analytics/hr-dashboard?from=…&to=…&departmentId=…`; `GET /analytics/admin-dashboard?...`; `GET /analytics/employee-dashboard`.
- **PDF checklist:** **18 PARTIAL**. Demographic gender/tenure fields do not exist in `Employee`; the Admin view shows an explanatory empty state. Some formulas/filters differ from the brief: see “Known gaps and risks.”
- **Code:** [DashboardPage.tsx](../frontend/src/pages/DashboardPage.tsx), [analytics.routes.ts](../backend/src/modules/analytics/analytics.routes.ts), [analytics.service.ts](../backend/src/modules/analytics/analytics.service.ts).

### M8 — AI assistant

- **Built:** chat, dashboard summary, smart-leave prefill, policy prompt, AI-generated labels, per-user rate counting, provider timeout and fallback, and `AiLog` writes.
- **Main screens:** `/assistant`; chat panel on Employee dashboard; Summarize buttons on Admin/HR dashboards; Smart leave on `/leave`.
- **Main API endpoints:** `POST /ai/chat`, `POST /ai/summarize`, `POST /ai/smart-leave`, `GET /ai/tooling-check`.
- **PDF checklist:** **19 PARTIAL**, **20 PARTIAL**, **21 PARTIAL**, **22 PARTIAL**. The tool calling and forms exist, but tool scope, output validation and policy coverage have gaps detailed in section 6.
- **Code:** [AiAssistantPage.tsx](../frontend/src/pages/AiAssistantPage.tsx), [ai.routes.ts](../backend/src/modules/ai/ai.routes.ts), [ai.service.ts](../backend/src/modules/ai/ai.service.ts).

### M9 — Communications and audit

- **Built:** Admin/HR announcements; all-role announcement reads; per-user notification list/count/read; Admin-only audit filters and before/after JSON display.
- **Main screens:** `/communications`, notification bell in the app shell, `/audit`.
- **Main API endpoints:** `GET/POST /comms/announcements`; `GET /comms/notifications`; `GET /comms/notifications/unread-count`; `POST /comms/notifications/:id/read`; `GET /comms/audit-logs`.
- **PDF checklist:** **23 DONE**, **24 PARTIAL**, **25 PARTIAL**. Leave decisions and payroll finalization create notifications; correction decisions do not. Most important domain writes call the audit helper, but marking a notification read is not audited and password-change audit rows do not contain before/after JSON.
- **Code:** [CommunicationsPage.tsx](../frontend/src/pages/CommunicationsPage.tsx), [NotificationBell.tsx](../frontend/src/components/NotificationBell.tsx), [AuditPage.tsx](../frontend/src/pages/AuditPage.tsx), [comms.service.ts](../backend/src/modules/comms/comms.service.ts), [audit.ts](../backend/src/lib/audit.ts).

**Optional camera bonus:** client-side face detection and blink detection plus server-side GPS/radius and face-descriptor checks exist in code. Hardware-based verification was not run. The bonus should be described as implemented but not fully field-tested, not as a production identity guarantee.

## 3. How it works

### Architecture in simple words

1. The **frontend** is the React app the user sees. React builds screens from components; Vite serves and bundles those files. React Router selects the page. Tailwind provides styling, and Recharts draws dashboard charts.
2. The frontend calls the **backend** through a REST API. REST means the browser uses URLs and HTTP methods such as GET to read and POST to create data. Requests and responses use JSON, a structured text format for values and objects. The shared typed client attaches a signed login token and sends a user back to login on 401.
3. The backend is Node.js + TypeScript + Express. Routes parse request data, then services implement rules. Zod is the request validator. The error handler maps validation and application errors to HTTP responses.
4. Prisma is an ORM (object-relational mapper, or database mapper): it maps TypeScript data models to PostgreSQL tables. PostgreSQL stores users, employees, attendance, leave, payroll, settings, audit and AI logs. Migrations create/alter tables from `backend/prisma/schema.prisma`.
5. The AI service calls DeepSeek’s OpenAI-compatible chat API from the backend. An AI tool call is the model asking the backend to run a named data query; the model itself has no database connection.
6. The face library runs in the browser using local files under `frontend/public/models`; the API sends descriptor/GPS values, never an image.

### Folder map and entry points

- [frontend/src/App.tsx](../frontend/src/App.tsx) contains routes and layout composition.
- [frontend/src/pages](../frontend/src/pages) contains the screens.
- [frontend/src/api](../frontend/src/api) contains typed request/response shapes and the API client.
- [frontend/src/auth](../frontend/src/auth) contains login state and route/role guards.
- [frontend/src/components](../frontend/src/components) contains shared layout, feedback and notification UI.
- [frontend/src/face](../frontend/src/face) contains face-model loading, detection and blink tracking.
- [backend/src/server.ts](../backend/src/server.ts) starts Express and mounts route modules.
- [backend/src/modules](../backend/src/modules) separates routes, schemas and services for auth, org, employees, attendance, leave, payroll, analytics, AI and comms.
- [backend/src/middleware](../backend/src/middleware) contains authentication, validation and errors; [backend/src/lib](../backend/src/lib) contains JWT, database and audit helpers.
- [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) defines the relational data; [backend/tests](../backend/tests) contains the rule tests.

### Data flow

1. On first run, `/auth/setup-status` checks whether an Admin exists. Admin setup stores a company name and creates the first Admin account. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured, the status check can create an Admin automatically.
2. Admin sets office rules, teams, leave types and holidays; creates HR accounts.
3. HR registers employees. The backend creates the employee login with a temporary password and `mustChangePassword=true`.
4. Employees change their password, check in/out, apply for leave and can request attendance corrections. HR reviews leave and attendance corrections.
5. HR creates payroll drafts from employee salary, attendance and approved leave. Admin finalizes the run. The backend creates notifications and payslip PDFs.
6. Dashboard endpoints query the same database for each role. AI tools query selected database/service data and return text; AI does not save leave or payroll data.

### Stack and reasons

The decision notes say the Node/Express/TypeScript + React/Vite/TypeScript stack was chosen for hackathon speed. PostgreSQL fits linked company records such as employees, approvals and payslips; Prisma provides schema and migrations. Express provides a small HTTP API structure; TypeScript catches many type mistakes at build time. React components keep screens reusable, Vite gives a quick development server/build, Tailwind provides responsive styles, and React Router maps URLs to role-protected pages. bcrypt hashes passwords; jsonwebtoken signs time-limited login tokens; Zod checks request shapes; PDFKit creates payslips. Recharts draws dashboard visuals. `@vladmandic/face-api` supplies face detection, face landmarks (key points around eyes and other facial features) and descriptors. DeepSeek is configured by backend environment variables, not hard-coded in the browser.

The database decision mentions Neon, but this repository has no deployment or hosting configuration.

## 4. Business rules implemented

### Attendance

- The server uses its own clock, not a browser-submitted time, for check-in/out.
- Default office start is 09:00, grace is 15 minutes, half-day threshold is 5 hours, weekend is Sunday and Saturday, and default camera radius is 150 m. Settings are stored under the `organization` key.
- A second same-day check-in returns 409. A check-in strictly later than start + grace is `LATE`; exactly at the grace cutoff is not late. A checked-out day under 5 hours is `HALF_DAY`; otherwise the initial late status is retained.
- `ABSENT` and `MISSING_CHECKOUT` exist in the enum, but there is no background process that writes those statuses when a person has no record or forgets checkout.
- The calendar can add virtual `ON_LEAVE` entries for approved leave; it is not a full attendance generator.

### Leave

- `countWorkingDays` includes the start and end dates and skips configured weekend days and holiday dates.
- The default leave-type helper defines Annual 14, Sick 8, Casual 10 and Unpaid unlimited. An Admin must invoke the UI bootstrap action to create these defaults.
- Apply rejects invalid date order, no-working-day periods, overlap with an existing pending/approved request, and insufficient approved balance with 422.
- An Employee can cancel a pending request or a future approved request. Approve/reject needs Admin/HR and a comment; decisions notify the Employee.
- A pending request is not reserved against the balance until approval. Cross-year balances are not split accurately.

### Payroll formula and worked example

For basic monthly salary **PKR 100,000** (Pakistani rupees):

1. HRA = 40% = PKR 40,000; medical = 10% = PKR 10,000; gross = PKR 150,000.
2. Annual gross = PKR 1,800,000. Tax is PKR 30,000 + 15% of (PKR 1,800,000 − PKR 1,200,000) = PKR 120,000/year, or **PKR 10,000/month**.
3. With 20 working days, daily gross pay = PKR 150,000 ÷ 20 = PKR 7,500.
4. For one absent day, two unpaid days and two half days: deduction units = 1 + 2 + (2 × 0.5) = 4. Attendance deduction = 4 × PKR 7,500 = PKR 30,000.
5. Total deductions = PKR 30,000 + PKR 10,000 tax = PKR 40,000; net = PKR 150,000 − PKR 40,000 = **PKR 110,000**.

The code’s tax bands are: up to PKR 600,000 annual gross, zero; up to 1.2M, 5% above 600k; up to 2.4M, 30k + 15% above 1.2M; up to 3.6M, 210k + 25% above 2.4M; above 3.6M, 510k + 35% above 3.6M. It divides annual tax by 12.

**Important difference from the brief:** the payroll service computes employee working days for absences, but it does not prorate gross salary for a joiner/leaver. The example above is a full-month employee and does not demonstrate that missing rule.

## 5. Security and access

- Passwords are hashed with bcrypt at cost 12 in the setup, HR-account, employee-account and reset flows. The database stores the hash, not the submitted password.
- Login returns a JWT (a signed, time-limited badge); it expires after 8 hours. Each authenticated request verifies the token, reloads the user and checks `isActive`. Role checks are server middleware; employee-owned services also compare `employeeId`.
- The frontend stores the token in `localStorage`, sends it in the HTTP Authorization header and clears it on 401. This is convenient but means XSS (cross-site scripting: malicious code injected into a page) could steal the token. There is no refresh token or server logout/revocation endpoint.
- Most request bodies/params/queries have Zod schemas. The shared error handler returns 400 for Zod errors, 401 for unauthenticated, 403 for role/scope, 409 for unique conflicts and application conflicts, and 422 for business-rule failures. Not every query uses Zod; `/leave/balance/me` reads its optional year manually.
- HR and Admin can read company employees. Employee list/profile, attendance, leave, payslip and notification routes contain employee-specific filters/checks. The audit endpoint checks Admin role.
- `audit()` writes actor, action, entity, entity ID and optional before/after JSON. There are no audit-log edit/delete routes. Some writes are not fully audited: notification-read updates do not create audit entries, and password-change audit has no before/after JSON.
- `.env` files are ignored by git. Only placeholder variables belong in `.env.example`. `AI_API_KEY` is read by the backend AI service; the browser does not call DeepSeek directly.

**Not protected / not implemented:** no multi-company tenant ID, MFA, login throttling/account lockout, email verification, password-reset email flow, or refresh-token rotation. Account deactivation is checked on each request, but a still-active user’s token remains usable until expiry. AI log prompts/responses are stored in `AiLog` without a retention policy.

## 6. AI features

### Chat and tools

`POST /ai/chat` sends a system instruction and the user’s message to the configured model with seven tools:

1. `get_headcount` — active/probation employee count, optional department.
2. `get_attendance_summary` — calls Admin or HR dashboard service by role.
3. `get_late_comers` — groups late records and returns names/counts.
4. `get_leave_summary` — aggregates approved leave days by leave type.
5. `get_my_leave_balance` — Employee’s own balance; explicitly rejects non-Employee use.
6. `get_payroll_summary` — totals for Admin/HR; for Employee returns only that Employee’s payslip values.
7. `search_employees` — directory search; explicitly rejects Employee use.

The backend executes at most the first tool call returned in a chat response, then asks the model to write a final answer. The chat UI displays conversation history, but each API call sends only the new message; previous messages are not sent as context.

### Summary, smart leave and guardrails

- Dashboard summary sends the supplied KPI JSON and asks for 3–5 short bullets using only those numbers. Zod checks that `kpis` is a record, but the backend does not independently recompute/check its values or enforce the exact number of bullets.
- Smart leave sends today’s date and requests `{type,start,end,reason}` JSON. The model is retried once if JSON parsing/required-field checks fail. The result only prefills the browser form; the user submits the leave request separately. Output is manually checked for non-empty fields, not validated with Zod.
- The provider, base URL and model come from `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` in backend environment variables.
- Each provider HTTP call has a 15-second abort timer. Chat and summary return friendly text fallbacks on provider failures; smart leave returns a fallback form object. A tool round may make two provider calls, each with its own timer.
- The service counts recent `AiLog` rows and limits a user to about 20 logged calls per hour. Calls are written to `AiLog`.
- The UI labels answers “AI-generated.”

### Salary refusal and privacy gap

For Employee chat, the service refuses a message if it matches the simple case-insensitive text pattern `salary|pay of|colleague|other employee`. In addition, `get_payroll_summary` filters to the logged-in Employee’s own payslip, and employee directory search is denied.

This is not a complete policy firewall. Some tools are not Employee-scoped: `get_late_comers` returns other employees’ names and `get_leave_summary` aggregates company leave. `get_headcount` is company-wide. Avoid asking Employee chat for company-wide attendance/leave/person lists until those tools enforce the intended scope. The salary refusal is a prompt-text pattern, not a semantic guarantee.

## 7. Face attendance

### Flow and checks

1. On `/face/register` or `/face/check-in`, the browser loads the Tiny Face Detector, 68-point landmark model and face-recognition model from `/models`.
2. The browser opens the front camera, displays a live preview and oval guide, and detects faces about every 450 ms. Detection uses TinyFaceDetector with input size 320 and score threshold 0.5.
3. Exactly one face is required by the UI. The browser computes a 128-number descriptor. Blink tracking requires eye aspect ratio at least 0.25 (open), at most 0.19 (closed), then open again.
4. Enrollment sends the descriptor to `PATCH /employees/me/face-descriptor`; the Employee’s descriptor is stored as JSON. No image is uploaded.
5. Camera check-in reads GPS latitude, longitude and accuracy from the browser and sends them with `source=CAMERA`, face count, descriptor and blink result to `POST /attendance/check-in`.
6. The **server** checks exactly one face, coordinates present, GPS accuracy no worse than 100 m, configured office location, distance within the configured radius and blink result. It compares the submitted descriptor with the stored descriptor using Euclidean distance (straight-line difference between two number vectors) and rejects if distance is greater than **0.5**. The office-distance calculation uses the Haversine formula (a way to estimate distance over Earth from two latitude/longitude points). The server stamps attendance time.
7. The Attendance row stores source, GPS values, accuracy and `faceMatchScore` (the stored value is the Euclidean distance, so lower is a closer match). It does not store a photo.

HR/Admin can reset a face descriptor from an employee profile. The before-image in that reset/enrollment audit path can include the previous descriptor, so biometric data may also appear in audit JSON.

### Limits

The descriptor and blink result are produced in the browser and the server trusts the submitted blink Boolean and face count. A determined attacker can alter browser requests or submit a fabricated descriptor. This is hackathon-grade verification, not strong identity proof. A webcam, camera permission, HTTPS/localhost and usable GPS are required. A person may be indoors and still have GPS accuracy worse than 100 m. The server does not return exact distance, only accepts or rejects.

The three model manifests and weight files are under [frontend/public/models](../frontend/public/models). Live camera/GPS behavior was not verified with physical hardware in this environment.

## 8. Tests

The backend has six small Node test-runner tests:

- [attendance.engine.test.ts](../backend/tests/attendance.engine.test.ts): check-in after grace is late; short work time is half-day.
- [leave.rules.test.ts](../backend/tests/leave.rules.test.ts): weekdays excluding a weekend/holiday; one quota-minus-usage balance.
- [payroll.rules.test.ts](../backend/tests/payroll.rules.test.ts): one tax point at PKR 120,000 monthly gross; attendance deduction units.

The verified command is `cd backend; npm run test:unit`; the last recorded run passed all six tests. Both backend and frontend TypeScript production builds also passed.

There are no automated integration tests for route authorization, database transactions, CSV, dashboard formulas, AI tool scopes/fallbacks, PDF access, or face/GPS behavior. There are no frontend unit or browser end-to-end tests. API smoke checks have been run manually, but not as a repeatable suite.

## 9. Known gaps and risks

| Risk | What the code does | Demo impact and recovery |
|---|---|---|
| Fresh demo database | This development database already had records from earlier API smoke checks; this project summary task did not reset it. | Use a separate empty PostgreSQL database and run migrations before the judging demo. Do not delete the configured database to make it look fresh. |
| Setup state | First-run setup appears only if no Admin exists. `setup-status` can bootstrap an Admin from env credentials. | Verify the selected demo database’s setup state before showing the setup page; do not assume the current database is fresh. |
| Missing absent/missing-checkout generation | No scheduled worker writes those attendance statuses. Board shows saved records; calendar shows `ON_LEAVE` rows but otherwise “No record.” | Do not present “No record” as a calculated absence. Seed activity manually through real check-ins/approvals during a demo. |
| Payroll joiners/leavers | Gross is not prorated for employment dates, despite the brief’s rule. | Avoid demonstrating a joiner/leaver month as a correct prorated result. Use a full-month employee for the worked payroll example. |
| Draft payslip access | UI hides draft PDF buttons, but the backend payslip/PDF service checks employee ownership, not that the run is finalized. | Treat draft data as confidential; do not share draft IDs. A future fix should require `FINALIZED` server-side before returning an Employee payslip/PDF. |
| Dashboard formulas | HR counts half-days as a full “present”; absenteeism and late percentages are simplified; Admin attrition uses current headcount, average salary uses current employee basic × 1.5, and payroll date/department filters do not fully constrain payroll totals. | Do not claim every chart equals the brief formula. Reconcile any judge question manually with database records and describe these as current approximations. |
| Admin gender/tenure chart | `Employee` has no gender field and the API returns a note rather than aggregates. | Say this dimension is unavailable; do not invent demographic data. |
| Leave balance | Pending requests do not reserve quota; the annual grouping is by request start date and cross-year requests are not split. | Avoid overlapping pending requests near a quota boundary; review balance again before approval. |
| CSV import | Parser splits on literal commas and lines; it does not support quoted commas or duplicate values within the same file. Confirm runs row-by-row without a transaction. | Use a simple CSV with no comma-containing fields, run dry-run, and fix all errors before confirm. Keep a database backup before bulk imports. |
| HR/employee login management | UI lists HR users only. Employee account deactivate/reset routes are available by ID, but no employee-login list/control screen is built. | Do not promise an Admin UI for employee account reset/deactivation; use the existing Admin endpoint only if an employee ID is known. |
| Role matrix differences | Admin can create/edit employees, change salary and import CSV in the UI; the server also allows Admin to create payroll drafts and approve leave. The PDF matrix gives some of those actions only to HR. Conversely, HR cannot use the Employee-only check-in or leave-apply routes. | Use the specific role limitations in `PROJECT.md` as the intended product policy. Treat these current permissions as gaps to fix before a strict RBAC review. |
| Employee temporary passwords | Employee temporary passwords are generated with `Math.random`, not a cryptographic random generator. | Copy them once and make the Employee change them immediately. A production version should generate them cryptographically or use a secure invitation flow. |
| Audit completeness | Most organization, employee, attendance, leave and payroll changes use `audit()`, but notification read state is not audited and password-change audit has no before/after JSON. | Use audit as a helpful history, not a legally complete immutable record. |
| AI scope and output | Some Employee-available AI tools return company-wide counts/names/leave aggregates. Salary refusal uses a regex. Dashboard-summary inputs and smart-leave output are not fully Zod-validated. | Keep Employee questions to personal balance/policy and do not rely on AI for high-impact decisions. Use HR dashboard/leave screens for people lists. |
| AI “who is on leave?” question | `get_leave_summary` returns totals by leave type, not employee names. There is no tool that lists people currently on approved leave. | Use `/leave` to inspect request rows. Do not present an aggregate as a list of names. |
| AI provider failure | Chat/summary catch provider errors and log fallback text; missing AI environment configuration can fail before the fallback catch. Tool call round may take two 15-second calls. | Set and test the AI environment before the demo. If unavailable, use normal forms and dashboards; smart leave is never required to apply leave. |
| Face liveness and spoofing | Browser submits face count, descriptor and blink Boolean; server validates values and descriptor distance but cannot prove the browser camera was genuine. | Explain the limit. For a failed demo, stop camera use and request an attendance correction. |
| Face/GPS hardware | Real camera and GPS permissions were not tested here. Location may be unavailable or too inaccurate indoors. | Test the exact laptop/phone and location before demo day; use HTTPS or localhost; configure office coordinates; have web check-in/correction as fallback. |
| Large face library | The lazy-loaded face-api JavaScript chunk is about 1.33 MB minified (about 340 KB gzip), plus local model weights. | Open the camera page before the live demo so assets load; keep model files in `frontend/public/models`. |
| No deployment / demo video | No hosting setup, hosted link, or demo video is included. | Deploy separately only when the team chooses; this documentation task did not deploy anything. |

## 10. Reviewer Q&A

1. **Why use React and Vite?** The project notes chose them for fast web-app development. **Proof:** [DECISIONS.md](../DECISIONS.md), [frontend/package.json](../frontend/package.json).
2. **Why TypeScript?** It gives compile-time types for routes, services and frontend API data. **Proof:** [backend/tsconfig.json](../backend/tsconfig.json), [frontend/src/api/types.ts](../frontend/src/api/types.ts).
3. **Why PostgreSQL?** HCM records have relationships and uniqueness rules, such as one user per employee and one payroll run per month. **Proof:** [schema.prisma](../backend/prisma/schema.prisma).
4. **What does Prisma do?** It maps TypeScript models to PostgreSQL and provides migration history. **Proof:** [schema.prisma](../backend/prisma/schema.prisma), [backend/prisma/migrations](../backend/prisma/migrations).
5. **Why separate routes and services?** Routes parse requests and call services; service files hold most business rules. **Proof:** [attendance.routes.ts](../backend/src/modules/attendance/attendance.routes.ts), [attendance.service.ts](../backend/src/modules/attendance/attendance.service.ts).
6. **Where does the backend start?** Express middleware and module routers are mounted in the server entry file. **Proof:** [server.ts](../backend/src/server.ts).
7. **How is the first Admin created?** The setup endpoint creates one Admin; an optional env bootstrap exists. **Proof:** [auth.service.ts](../backend/src/modules/auth/auth.service.ts).
8. **How are passwords stored?** bcrypt hashes them with work factor 12; the hash is stored in `User.passwordHash`. **Proof:** [auth.service.ts](../backend/src/modules/auth/auth.service.ts), [employees.service.ts](../backend/src/modules/employees/employees.service.ts).
9. **What is a JWT?** A signed token the browser sends with requests; this one expires after 8 hours. **Proof:** [jwt.ts](../backend/src/lib/jwt.ts), [client.ts](../frontend/src/api/client.ts).
10. **How are roles enforced?** `requireAuth` reloads the active user, and `requireRole` checks allowed roles server-side. **Proof:** [auth.ts](../backend/src/middleware/auth.ts).
11. **How is employee scope checked?** Employee reads are filtered to the token’s employee ID or explicitly compared against it. **Proof:** [employees.service.ts](../backend/src/modules/employees/employees.service.ts), [leave.service.ts](../backend/src/modules/leave/leave.service.ts).
12. **Can the frontend menu secure an endpoint?** No. It hides routes, while the backend is the security boundary. **Proof:** [RouteGuards.tsx](../frontend/src/auth/RouteGuards.tsx), [auth.ts](../backend/src/middleware/auth.ts).
13. **Is there an API logout endpoint?** No. The frontend removes its local token; the server token remains valid until expiry or account deactivation. **Proof:** [AuthContext.tsx](../frontend/src/auth/AuthContext.tsx), [jwt.ts](../backend/src/lib/jwt.ts).
14. **How are request errors returned?** Zod errors map to 400; known Prisma uniqueness errors to 409; AppError supplies other statuses. **Proof:** [error-handler.ts](../backend/src/middleware/error-handler.ts).
15. **How are audit rows stored?** Actor, action, entity, entity ID and optional before/after JSON are stored in `AuditLog`. **Proof:** [audit.ts](../backend/src/lib/audit.ts), [schema.prisma](../backend/prisma/schema.prisma).
16. **Can an Admin edit/delete audit history through the app?** No edit/delete routes are mounted; the screen is read-only. **Proof:** [comms.routes.ts](../backend/src/modules/comms/comms.routes.ts), [AuditPage.tsx](../frontend/src/pages/AuditPage.tsx).
17. **How does late status work?** The service compares server check-in time with office start plus grace; after the cutoff is late. **Proof:** [attendance.engine.ts](../backend/src/modules/attendance/attendance.engine.ts).
18. **Does the app automatically create absent records?** No. `ABSENT` exists in the enum, but no background process writes it. **Proof:** [schema.prisma](../backend/prisma/schema.prisma), [attendance.service.ts](../backend/src/modules/attendance/attendance.service.ts).
19. **How does the app count leave days?** It iterates dates and excludes configured weekend days and stored holidays. **Proof:** [leave.rules.ts](../backend/src/modules/leave/leave.rules.ts).
20. **Do pending leave requests reserve a quota?** No; balance usage sums approved requests. **Proof:** [leave.service.ts](../backend/src/modules/leave/leave.service.ts).
21. **What is the payroll gross formula?** Basic + 40% HRA + 10% medical = 1.5× basic. **Proof:** [payroll.rules.ts](../backend/src/modules/payroll/payroll.rules.ts).
22. **How is payroll locked?** Only Admin can finalize; a later draft/recalculation for a finalized month returns 409. **Proof:** [payroll.service.ts](../backend/src/modules/payroll/payroll.service.ts).
23. **Is joiner/leaver gross prorated?** Not currently; the code computes employee working days for absence deductions but keeps gross at the full monthly amount. **Proof:** [payroll.service.ts](../backend/src/modules/payroll/payroll.service.ts).
24. **Can an Employee fetch a draft payslip by API?** The code filters to the Employee’s own payslip, but does not check the run’s finalized status in the PDF lookup. That is a known gap. **Proof:** [payroll.service.ts](../backend/src/modules/payroll/payroll.service.ts).
25. **Where do dashboard numbers come from?** Analytics services query Prisma; the frontend charts use returned values. Some formulas/filters are still approximations. **Proof:** [analytics.service.ts](../backend/src/modules/analytics/analytics.service.ts), [DashboardPage.tsx](../frontend/src/pages/DashboardPage.tsx).
26. **Why is there no gender chart?** The Prisma Employee model has no gender field; the API returns an explanatory note. **Proof:** [schema.prisma](../backend/prisma/schema.prisma), [analytics.service.ts](../backend/src/modules/analytics/analytics.service.ts).
27. **Which AI tools exist?** Headcount, attendance summary, late-comers, leave summary, own leave balance, payroll summary, and employee search. **Proof:** [ai.service.ts](../backend/src/modules/ai/ai.service.ts).
28. **Can the model query PostgreSQL directly?** No database credentials are sent to the model; the backend runs tools. Some tool implementations query Prisma directly, and some need tighter role scope. **Proof:** [ai.service.ts](../backend/src/modules/ai/ai.service.ts).
29. **How is colleague salary refused?** A regex refuses common salary/colleague phrasing, and Employee payroll-summary results are filtered to their own employee ID. The regex is not a complete semantic security barrier. **Proof:** [ai.service.ts](../backend/src/modules/ai/ai.service.ts).
30. **What if DeepSeek is down?** Provider failures generally produce a friendly fallback and are logged; missing configuration can fail before that fallback. **Proof:** [ai.service.ts](../backend/src/modules/ai/ai.service.ts).
31. **What is the AI rate limit?** About 20 logged calls per user in the last hour, based on `AiLog` count. **Proof:** [ai.service.ts](../backend/src/modules/ai/ai.service.ts).
32. **Does smart leave submit a request?** No. It returns suggested values for the form; the Employee must review and submit normally. **Proof:** [LeavePage.tsx](../frontend/src/pages/LeavePage.tsx), [ai.service.ts](../backend/src/modules/ai/ai.service.ts).
33. **Where do face models load from?** The browser loads the detector, landmark and recognition models from `/models`, served from `frontend/public/models`. **Proof:** [faceApi.ts](../frontend/src/face/faceApi.ts), [frontend/public/models](../frontend/public/models).
34. **What does the server check for camera attendance?** Exactly one submitted face, coordinates, GPS accuracy ≤100 m, office location/radius, blink Boolean and face distance ≤0.5. **Proof:** [attendance.service.ts](../backend/src/modules/attendance/attendance.service.ts).
35. **How can face attendance be fooled?** The browser supplies face count, descriptor and blink result; a determined user can modify the request. **Proof:** [FacePages.tsx](../frontend/src/pages/FacePages.tsx), [attendance.service.ts](../backend/src/modules/attendance/attendance.service.ts).
36. **Is a photo stored?** No. The browser sends a descriptor and the server stores the descriptor, match distance and attendance/GPS result. **Proof:** [employees.service.ts](../backend/src/modules/employees/employees.service.ts), [schema.prisma](../backend/prisma/schema.prisma).
37. **How would you scale this?** First add integration tests and query indexes based on measured workload, paginate more endpoints, move slow AI/PDF work to queued jobs, and use managed PostgreSQL capacity. These are future ideas, not current features. **Proof:** [server.ts](../backend/src/server.ts), [schema.prisma](../backend/prisma/schema.prisma).
38. **What would you build next?** Fix Employee AI tool scopes, correct dashboard formulas, implement absent/missing-checkout generation, prorate payroll, and validate finalized payslips server-side. **Proof:** [ai.service.ts](../backend/src/modules/ai/ai.service.ts), [analytics.service.ts](../backend/src/modules/analytics/analytics.service.ts), [payroll.service.ts](../backend/src/modules/payroll/payroll.service.ts).

## 11. Demo walkthrough

**Preflight (before the five minutes):** use a separate fresh database, run Prisma migrations, set backend env variables, start backend and frontend on localhost/HTTPS, verify `/health`, check the AI provider, and configure a real demo office location. Do not use the already populated development database as a “fresh install.”

| Time | Clicks | What to say |
|---|---|---|
| 0:00–0:35 | On a fresh database open the app; complete `/setup` with company name and Admin account. | “Setup creates the first Admin; there is no seed employee data.” |
| 0:35–1:10 | Admin opens Organization; saves office time/location/radius; adds a department and designations; creates standard leave types; opens Users and creates HR. Copy the temporary credential privately. | “Rules and quotas are stored on the server and used by later modules.” |
| 1:10–1:45 | Sign in as HR; open Employees, register two employees, assign department/designation/salary, save and privately copy the displayed temporary password. | “Employee registration creates the linked login and forces a password change.” |
| 1:45–2:15 | Sign in as one Employee; change password; open Attendance and check in. If using the bonus flow, enroll face first and open Camera check-in; otherwise use web check-in. | “The server records check-in time. Camera mode additionally validates face descriptor and GPS.” |
| 2:15–3:00 | Employee opens Leave; enter a sentence in Smart leave; review/edit prefilled dates/type/reason and submit. Sign in as HR; open Leave and approve with comment. | “AI only prefills; the user confirms before the leave is saved.” |
| 3:00–3:45 | HR opens Dashboard; select date range/department and click Summarize. Open Assistant and ask for an aggregate leave or attendance answer. | “Dashboard data comes from the service. The AI uses tools, but it cannot answer every question reliably; in particular, there is no names-returning ‘who is on leave’ tool.” |
| 3:45–4:25 | HR opens Payroll, sets/ verifies salary structure, selects month, creates and reviews draft. Sign in as Admin and finalize the month. | “Only Admin finalizes; the draft route rejects recalculation after lock.” |
| 4:25–5:00 | Employee opens Payroll and downloads the PDF. Ask the Employee assistant about a colleague’s salary. Admin opens Audit. | “Employee payslips are scoped to their own account; the common salary question is refused; Admin can inspect audit events.” |

If AI is unavailable, continue the ordinary leave form and show dashboard values without summarizing. If camera or GPS fails, use web check-in or the correction request. Do not claim the AI can list all people currently on leave; its current leave tool returns aggregate days by type, not names.

### Two-minute “explain the code” tour

Open these **eight** files in this order:

1. [frontend/src/App.tsx](../frontend/src/App.tsx) — show public routes, role guards and the dashboard/app layout.
2. [frontend/src/api/hcm.ts](../frontend/src/api/hcm.ts) — show the typed API wrappers the screens use.
3. [backend/src/server.ts](../backend/src/server.ts) — show Express middleware and module route mounting.
4. [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) — show the relational models, status enums and unique constraints.
5. [backend/src/middleware/auth.ts](../backend/src/middleware/auth.ts) — show current-user reload, role guard and employee scope helper.
6. [backend/src/modules/attendance/attendance.service.ts](../backend/src/modules/attendance/attendance.service.ts) — show server time, check-in duplicate handling, camera GPS and descriptor validation.
7. [backend/src/modules/payroll/payroll.rules.ts](../backend/src/modules/payroll/payroll.rules.ts) — show fixed HRA/medical, deduction units and tax bands.
8. [backend/src/modules/ai/ai.service.ts](../backend/src/modules/ai/ai.service.ts) — show server-side provider call, tool definitions, rate limit/logging, and salary refusal check.

Finish by stating the key limits: no automatic absence job, no joiner/leaver gross proration, incomplete AI tool scoping, no gender/tenure data, and browser-generated face/liveness inputs.

## 12. Ten demo-day checks

1. Confirm you are using the intended **fresh** database; do not reset a shared database.
2. Run migrations and verify backend `/health`.
3. Confirm `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL`, and AI settings are in local backend env only.
4. Test first-run setup and Admin login on that database.
5. Set office start/grace/weekend and real coordinates/radius; verify the browser’s origin is localhost or HTTPS.
6. Create standard leave types, department and designation before employee registration.
7. Create HR and employees; copy each temporary password privately and change it on first sign-in.
8. Test one check-in, a duplicate check-in response, one leave approval, and a payroll draft/finalization.
9. Check AI tool calling/provider availability, one smart-leave prefill, the employee-salary refusal, audit events and notifications.
10. If demonstrating camera mode, enroll a face, allow camera and GPS, verify GPS accuracy ≤100 m and use a real camera; have web attendance/correction ready as fallback.
