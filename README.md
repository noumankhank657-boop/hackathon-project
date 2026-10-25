# HCM Lite

## Stack
- Backend: Node.js, TypeScript, Express, Prisma, PostgreSQL, Zod, JWT, bcrypt, PDFKit
- Frontend: React, Vite, TypeScript, Tailwind, React Router, Recharts, `@vladmandic/face-api`
- AI: DeepSeek (OpenAI-compatible API) via backend-only key

## Local run
1. Copy the root `.env.example` to `backend/.env`, then set `DATABASE_URL` and `JWT_SECRET`.
2. In one terminal:
   ```powershell
   Set-Location backend
   npm install
   npx prisma migrate dev
   npm run dev
   ```
3. In another terminal:
   ```powershell
   Set-Location frontend
   npm install
   npm run dev
   ```
4. Open the Vite URL. The API URL defaults to `http://localhost:4000`; set `VITE_API_URL` in `frontend/.env` only if the backend uses another URL. Local development accepts `localhost` and `127.0.0.1`; for a hosted frontend, set `FRONTEND_URL` to its exact origin.

## First Admin creation
- On a fresh database, open the app and complete the first-run setup form with the company name, Admin email, and password.
- Alternatively, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before first run.
- After Admin exists, the setup endpoint refuses another first-run setup.

## AI key setup
In `backend/.env` set:
- `AI_API_KEY=...`
- `AI_BASE_URL=https://api.deepseek.com`
- `AI_MODEL=...`

The browser never receives the AI key.

## What is done
- Authentication, first-run setup, forced password change, role-aware routing and server-backed access.
- Organization settings, teams, leave types, holidays, HR user lifecycle, employee directory/profiles and CSV dry-run/import/export.
- Attendance calendar/check-in/out/corrections, leave applications/approvals/balances, payroll drafts/finalization and payslip PDFs.
- Admin, HR and Employee dashboards with server-provided metrics/charts; announcements, notifications, audit log and AI assistant UI.
- Local face detection/landmark/recognition models, face enrollment, blink check, camera check-in and server-validated GPS/radius.

## What is not done
- No deployment or hosting configuration is included.
- Employee records do not contain a gender field, so the Admin dashboard reports that gender/tenure analytics are unavailable rather than inventing values.
- A real webcam, camera permission, and GPS device are required to verify live face/liveness/location behavior; these hardware-dependent flows were not exercised in the current environment.
- The supplied database was already populated during earlier API smoke checks. The full demo script has not been rerun against a fresh database or entirely through the browser.
- No demo video or hosted link is included.

## Face matching limit (honest note)
Face descriptor extraction and blink detection happen in the browser for demo usability. A determined attacker can still spoof browser-side inputs, so this is suitable for hackathon demo-grade verification, not high-security production identity proofing.

The required model manifests and weights are included in `frontend/public/models` and are served locally; runtime model loading does not depend on a CDN.
