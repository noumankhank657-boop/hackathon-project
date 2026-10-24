# HCM Lite — Phases and Status

Rules for using this file:
- Each phase works on its own. An AI tool can start at any phase if the earlier phases are marked DONE and the code really has them (check the code, not just this table).
- Update the **Status** column after every phase. Values: `TODO`, `IN PROGRESS`, `DONE`, `BROKEN`.
- Read `PROJECT.md` for all rules. This file only says what to build and how to know it is finished.

## Status table

| # | Phase | Covers | Points area | Status |
|---|---|---|---|---|
| 0 | Setup and scaffold | repo, env, DB schema, server and app run | foundation | DONE |
| 1 | Auth, roles, first-run setup | M1 · #01 #02 | Core, Security | DONE |
| 2 | Organization setup | M2 · #03 #04 #05 | Core | DONE |
| 3 | Employees | M3 · #06 #07 (CSV #08 later) | Core | DONE |
| 4 | Attendance (web) | M4 · #09 #10 #11 | Core | DONE |
| 5 | Leave | M5 · #12 #13 | Core | DONE |
| 6 | Payroll | M6 · #14 #15 #16 #17 | Core | DONE |
| 7 | Dashboards and analytics | M7 · #18 | Data and analytics | DONE |
| 8 | AI assistant | M8 · #19 #20 #21 #22 | AI | DONE |
| 9 | Face attendance (9A detect + location, 9B match + blink) | bonus | Bonus, AI | TODO |
| 10 | Comms and audit screens | M9 · #23 #24 #25 (+ CSV #08) | Core, Security | TODO |
| 11 | Polish, tests, README, deploy, demo | all | UI, Code, Docs | TODO |

## Where is face attendance in the order?

It is Phase 9, after the core flows, dashboards and AI, because those carry most of the points and face attendance needs a working check-in to plug into. But it is **prepared from Phase 1 and Phase 4**: the office location and radius are stored in Phase 2, and the attendance table in Phase 4 already has `source`, `lat`, `lng`, `accuracy`, and `faceMatchScore` fields. So Phase 9 is only "add the camera", not "rebuild attendance".

If you want face attendance earlier, you can do Phase 9A right after Phase 4. Nothing else depends on it.

## If time runs short (3 to 5 hours is tight)

Protect in this order: Phases 0 → 1 → 2 → 3 → 4 → 5 → 6 (the full demo story), then 8 (AI), then 7 (dashboards), then 9A, then 11 (README and deploy), then 9B, 10, CSV.
The demo story in the brief needs: setup → register employee → check-in → leave → approve → payroll → finalize → payslip → AI → audit log. Never end without a hosted link and a README.

---

## Phase 0 — Setup and scaffold

**Goal:** both apps run on a laptop and talk to a database.

**Build**
- Create `backend/` (Express + TypeScript + Prisma) and `frontend/` (Vite + React + TypeScript + Tailwind).
- Prisma schema for ALL tables at once (so later phases do not break it): `User`, `Employee`, `Department`, `Designation`, `LeaveType`, `LeaveRequest`, `Holiday`, `Attendance`, `AttendanceCorrection`, `Setting`, `PayrollRun`, `Payslip`, `Announcement`, `Notification`, `AuditLog`, `AiLog`.
  - `Attendance` fields must include: employeeId, date, checkIn, checkOut, status, source (`web` | `camera` | `correction`), lat, lng, accuracy, faceMatchScore (nullable).
  - `Employee` must include a nullable `faceDescriptor` (JSON) for Phase 9B.
- `.env.example` with: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `PORT`, `FRONTEND_URL`.
- `GET /health` on the backend. A frontend page that calls it and shows the result.
- Basic error-handler middleware and a zod validation helper.

**Done when:** `npm run dev` works in both folders, `/health` returns OK from the browser page, migration ran with no errors, `.env` is in `.gitignore`.

## Phase 1 — Auth, roles, first-run setup (M1, #01, #02)

**Build**
- First-run setup: if no Admin exists, show a setup screen (company name + Admin email + password); also read `ADMIN_EMAIL`/`ADMIN_PASSWORD` if set. After the Admin exists, the setup endpoint must refuse (409).
- Login, logout, change password (bcrypt, JWT). `mustChangePassword` flag forces a password change on first sign-in.
- Middleware: `requireAuth`, `requireRole(...)`, and a scope helper so an Employee only gets rows with their own `employeeId`.
- Audit helper `audit(actor, action, entity, before, after)` used from now on everywhere.
- Frontend: login page, auth context, protected routes, role-based menu shell for Admin / HR / Employee, empty dashboards.

**Done when:** fresh DB shows setup screen; Admin can log in; wrong role gets 403 on a protected endpoint (test with a quick request); password is stored hashed.

## Phase 2 — Organization setup (M2, #03 #04 #05)

**Build**
- Company settings (Admin edits, HR views): office start 09:00, grace 15 min, half-day 5 h, weekend Sat–Sun, office lat/lng, radius (default 150 m).
- CRUD for departments, designations, leave types with yearly quotas (annual 14, sick 8, casual 10, unpaid unlimited), public holidays. Admin manages, HR views.
- Admin creates HR logins; deactivate and reset password for any login.
- Screens for all of the above with loading/empty/error states. Audit every change.

**Done when:** Admin can do the "set up the company" part of the demo from the UI; HR can view but not change settings (403 on write).

## Phase 3 — Employees (M3, #06 #07)

**Build**
- HR registers an employee (job details, department, designation, joining date, salary basic). This also creates their `User` with a temporary password shown once to HR, and `mustChangePassword = true`.
- Edit details (HR). Employee can edit only own phone and address.
- Directory with server-side search, filters (department, status), paging. Employee 360 profile page. Employee sees only own profile.
- Validation: unique code and email, valid email, known department, ISO date, salary > 0.

**Done when:** HR registers an employee, that employee logs in, is forced to change the password, and cannot open another employee's profile (403).

## Phase 4 — Attendance on the web (M4, #09 #10 #11)

**Build**
- `POST /attendance/check-in` and `/check-out` for Employees. **Server time**. Second check-in on the same day = 409. Accept optional `lat`, `lng`, `accuracy`, `source` now (stored, not enforced yet) so Phase 9 plugs in.
- Status engine in the service (not in routes): `present`, `late` (after start + grace), `half_day` (under 5 h), `missing_checkout`, `absent` (no record, no approved leave, working day), `on_leave`. Weekends and holidays are not working days.
- Attendance calendar (Employee own; HR/Admin any) and the HR daily attendance board.
- Corrections: Employee requests with a reason; HR approves or rejects; approval updates the record with `source = correction`. Audit it.
- Unit tests for the status engine.

**Done when:** employee checks in, sees "late" or "present" correctly, second check-in returns 409, HR sees it on the board.

## Phase 5 — Leave (M5, #12 #13)

**Build**
- Apply for leave (type, start, end, reason). Working days only. Overlap with existing leave or not enough balance = 422 with a clear message.
- Cancel leave (own, while pending or approved and in the future). Balance and history per leave type.
- HR/Admin approval inbox: approve or reject with a comment. Approved leave makes the attendance status `on_leave` for those days. Create a notification for the employee. Audit it.
- Unit tests for working-day counting and balance.

**Done when:** employee applies, HR approves, balance goes down, calendar shows on_leave, an overlapping request returns 422.

## Phase 6 — Payroll Lite (M6, #14 #15 #16 #17)

**Build**
- Salary structure per employee (HR manages): basic; HRA 40%, medical 10%; gross = 1.5 × basic.
- Monthly payroll draft (HR): for every active employee compute per-day pay, deductions (absent + unpaid leave + 0.5 × half days), prorating for joiners/leavers, tax from the slab, net pay. Draft can be recalculated.
- Admin finalizes → the run is locked (all edits return 403/409). Audit it.
- Payslip PDF download (Employee own, HR/Admin all). Notify the employee when finalized.
- Unit tests for the tax slab and deductions.

**Done when:** HR creates the draft, Admin finalizes, edits after that are blocked, employee downloads a correct PDF.

## Phase 7 — Dashboards and analytics (M7, #18)

**Build**
- Server-side aggregation endpoints (SQL/Prisma aggregates, not frontend math) with filters: date range and department. Formulas are in `PROJECT.md` section 4.
- HR dashboard, Admin dashboard, Employee dashboard exactly as listed in `PROJECT.md` section 4, with charts and KPI cards.
- Reuse the same analytics service for the AI tools in Phase 8 so numbers always match.

**Done when:** after creating a few records by hand, every KPI on the dashboard matches a manual count.

## Phase 8 — AI assistant (M8, #19 #20 #21 #22)

**Build**
- AI client in `lib/ai` using env vars (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`). 15 s timeout, friendly fallback message, per-user limit about 20 requests per hour, log every call in `AiLog`.
- `POST /ai/chat` with tool calling and the 7 tools from `PROJECT.md` section 5. Tools call the existing services with the logged-in user's scope. Employee asking for a colleague's salary must be politely refused.
- `POST /ai/summarize` (Admin, HR): sends the KPI JSON for the current filters, returns 3–5 bullets using only those numbers.
- `POST /ai/smart-leave` (Employee): sentence → JSON `{type, start, end, reason}` validated with zod, retry once on failure, then fall back to the normal form. It never saves; the user confirms in the form. Use today's date in the prompt so "next Monday" is correct.
- Policy Q&A: business rules in the system prompt; answer only from them.
- Chat panel in the frontend, Summarize button on dashboards, smart-leave box on the leave form. Label answers "AI-generated".
- Optional bonus: understand Roman Urdu.

**Done when:** the four judge questions in `PROJECT.md` section 5 behave correctly for the right roles.

## Phase 9 — Face attendance (main extra feature)

### 9A — Camera check-in with face detection and location

**Build**
- Frontend: a "Camera check-in" screen (works on laptop and phone browser). Open the front camera with a live preview. Use `@vladmandic/face-api` (or MediaPipe) to detect faces in the live video; allow check-in only when **exactly one** face is found. Get GPS with the browser Geolocation API (lat, lng, accuracy).
- Send `lat`, `lng`, `accuracy`, `faceCount`, `source = camera` to the existing check-in endpoint. Do not send a full photo.
- Backend: for `source = camera`, the **server** rejects (422 with a clear reason) if: `faceCount !== 1`, GPS accuracy > 100 m, or distance from the office (Haversine/`geolib`) is greater than the radius in settings. Otherwise it records the check-in normally with the stored lat/lng/accuracy. The server stamps the time.
- Admin screen: set office location (a "use my current location" button helps) and radius.
- On failure, show the reason and a link to "request a correction".
- Host models locally under `frontend/public/models` (do not depend on a CDN during the demo).

**Done when:** one face + inside radius = saved with `source = camera`; no face, two faces, far away, or bad accuracy = rejected with the right message. Test the "far away" case by temporarily changing the office location.

### 9B — Face matching and blink check (stretch)

**Build**
- Enrollment: after first login (or from the profile page), the employee captures their face; compute the 128-number descriptor in the browser and save it on the employee (`faceDescriptor`). HR can reset it.
- At check-in: compute a descriptor from the live frame and send it. The server compares it with the stored one (Euclidean distance; start with threshold 0.5 and tune) and stores `faceMatchScore`. No match = reject.
- Liveness: simple blink check (eye aspect ratio from face landmarks) before the capture is accepted.
- Write the honest limit in the README (matching runs in the browser).

**Done when:** the enrolled employee passes; a different person is rejected; holding up a still photo without blinking is rejected.

## Phase 10 — Comms and audit screens (M9, #23 #24 #25) and CSV (#08)

**Build**
- Announcements: Admin and HR post; everyone reads on their dashboard.
- Notifications: bell icon with unread count; created on leave decisions, correction decisions and payslip finalization.
- Audit log screen (Admin only): filter by actor, action, entity; show before/after JSON. No edit or delete endpoints exist for it.
- CSV export for employees (HR). CSV import with a **dry run** that returns row + field + reason (required fields, unique code/email, valid email, known department, ISO date, salary > 0), then a confirm step.

**Done when:** employee gets a notification after leave approval; Admin sees the audit entries; HR cannot open the audit log (403).

## Phase 11 — Polish, tests, README, deploy, demo

**Build**
- Check loading, empty and error states on every screen; check the layout at 375 px.
- Run the unit tests. Fix the top bugs found by walking through the 5-minute demo script in the PDF on a **fresh database**.
- README: stack, how to run, how to create the first Admin, how to set the AI key, what is done and what is not done, honest face-matching limit.
- Deploy: database (Neon/Supabase), backend (Render), frontend (Vercel/Netlify). Set secrets in the host's env settings, never in git. The live site must open on first-run setup.
- Record a backup demo video (OBS). Make the repo public or share with judges. Submit both links on lms.saylaniit.com.

**Done when:** a stranger can open the hosted link, create the company, and finish the whole demo story.
