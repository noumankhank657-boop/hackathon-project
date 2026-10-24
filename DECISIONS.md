# HCM Lite — Decisions

Short notes on choices we made and why. Any AI tool must read this before changing the stack or structure. If you change a decision, add a new line with the date and the reason. Do not delete old lines.

## Decisions so far

1. **Event and goal.** Saylani Hackathon, 24 Oct 2026. Build HCM Lite exactly as the brief (`docs/HCM_Lite_Brief.pdf`) describes. Camera face attendance is treated as a main feature (Phase 9 in TASKS.md).
2. **Stack.** Backend: Node.js + TypeScript + Express + Prisma + PostgreSQL. Frontend: React + Vite + TypeScript + Tailwind. (Chosen for speed. NestJS was the other option; change this line if you switch.)
3. **Database.** PostgreSQL hosted on Neon (free). One database is used for local work and for the live demo. Tables are created by Prisma migrations, never by hand.
4. **AI provider.** DeepSeek API through its OpenAI-compatible endpoint, with tool calling.
   - `AI_BASE_URL=https://api.deepseek.com`
   - `AI_MODEL` is set in `.env` (see the DeepSeek docs for the current model name; the official quick start now lists `deepseek-v4-flash` and `deepseek-v4-pro`, older docs mention `deepseek-chat`). Use whichever name the DeepSeek dashboard or docs show, and test that tool calling works before building on it.
   - The key lives only in `backend/.env` as `AI_API_KEY`. It is never committed and never sent to the browser.
   - Provider, base URL and model are env variables, so the provider can be swapped (for example Groq or OpenRouter) without code changes.
5. **Secrets.** Only `.env.example` is committed. `.env` is in `.gitignore`.
6. **No dummy data.** No seed scripts with fake employees. The app starts empty.
7. **Hosting (only at the end, Phase 11).** Frontend on Vercel or Netlify, backend on Render, database already on Neon.
8. **Face attendance.** Detection and location check run first (9A). Face matching and blink check are a stretch (9B). Matching runs in the browser; this limit is written in the README.

## Open questions

- (add here)

## Change log

- 2026-10-24: file created.
- 2026-10-25: Added Prisma migration `20261025020000_add_user_name` to support optional user display names used in HR/Admin management and announcements.
- 2026-10-25: Verified DeepSeek tool-calling through `/ai/tooling-check` using current `AI_BASE_URL` and `AI_MODEL` from backend env (response returned tool call successfully).