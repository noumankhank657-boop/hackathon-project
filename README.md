# HCM Lite

## Stack
- Backend: Node.js, TypeScript, Express, Prisma, PostgreSQL, Zod, JWT, bcrypt, PDFKit
- Frontend: React, Vite, TypeScript, Tailwind
- AI: DeepSeek (OpenAI-compatible API) via backend-only key

## Local run
1. Create env files from `.env.example`:
   - `backend/.env`
   - `frontend/.env` (`VITE_API_URL=http://localhost:4000`)
2. Install dependencies:
   - `cd backend && npm install`
   - `cd frontend && npm install`
3. Run Prisma migration:
   - `cd backend && npx prisma migrate dev`
4. Start apps:
   - `cd backend && npm run dev`
   - `cd frontend && npm run dev`

## First Admin creation
- On fresh DB, open frontend and complete setup screen (company name + admin email/password).
- Optional env bootstrap: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before first run.

## AI key setup
In `backend/.env` set:
- `AI_API_KEY=...`
- `AI_BASE_URL=https://api.deepseek.com`
- `AI_MODEL=...`

The browser never receives the AI key.

## What is done
- Phase 1: auth, setup, role guards
- Phase 2: org settings, departments/designations/leave types/holidays, HR user admin
- Phase 3: employee registration, profile scope, directory, CSV dry-run/confirm/export
- Phase 4: attendance check-in/out, status engine, board/calendar, correction flow
- Phase 5: leave apply/approve/reject/cancel, balances, overlap and quota checks
- Phase 6: payroll draft/recalculate/finalize lock, tax slab, payslip PDF
- Phase 7: server-side dashboard aggregations for Admin/HR/Employee
- Phase 8: AI chat/tools, summarize, smart leave, rate-limit, timeout fallback, AI logging
- Phase 9A: camera check-in guardrails (exactly one face, location radius, GPS accuracy <= 100m)
- Phase 10: announcements, notifications, audit log APIs
- Phase 9B: face descriptor enrollment, server-side matching, blink check

## What is not done
- No deployment/hosting config in this repository.
- Frontend camera model binaries are expected under `frontend/public/models` for full on-device detection in browser.

## Face matching limit (honest note)
Face descriptor extraction and blink detection happen in the browser for demo usability. A determined attacker can still spoof browser-side inputs, so this is suitable for hackathon demo-grade verification, not high-security production identity proofing.
