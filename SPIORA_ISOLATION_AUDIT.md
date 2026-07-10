# SPIORA Isolation Audit — Phase A

**Date:** 2026-07-10  
**Scope:** Read-only audit of the copied project at `C:\Users\Nika\Desktop\spiora demo`  
**Status:** ⚠️ **NOT SAFE to run against production services or to push without isolation**

---

## 1. Workspace identity

| Check | Result |
|-------|--------|
| Working directory | `C:\Users\Nika\Desktop\spiora demo` |
| `package.json` name | `sharp-spice-team-platform` (not Spiora) |
| `.git` present | Yes |
| Git root | Same folder |
| Current branch | `main` |
| Git remote | `origin` → `https://github.com/Nikigo1983/Sharp-Spice-Team-Platform.git` (fetch + push) |

**Finding:** This copy is still a full clone of the **production platform repository**. A `git push` from this folder would update the original platform repo on GitHub.

---

## 2. Environment files

| File | Present | Notes |
|------|---------|-------|
| `.env.example` | Yes | Template; contains example production URLs, spreadsheet IDs, and default dev passwords |
| `.env.local` | Yes | **Active local config with real credentials populated** |
| `.env.development.local` | Yes | Overrides `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to empty |
| `.env` | No | — |
| `.env.production` | No | — |

`.env*.local` is listed in `.gitignore` — secrets are not committed, but they **are present on disk** in this working copy.

### 2.1 Variables configured in `.env.local` (values redacted)

| Variable group | Configured? | Risk if used as-is |
|----------------|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | **Critical** — connects to production platform Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Critical** — full DB/storage bypass of RLS |
| `EMIGRANT_SUPABASE_URL` | Yes | **Critical** — separate production Emigrant Desk DB |
| `EMIGRANT_SUPABASE_ANON_KEY` | Yes | High |
| `EMIGRANT_SUPABASE_SERVICE_ROLE_KEY` | Yes | **Critical** |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes | **Critical** — production service account |
| `GOOGLE_PRIVATE_KEY` | Yes | **Critical** |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Yes | **Critical** — real CRM spreadsheet |
| `GOOGLE_SHEETS_PUBLIC_CLIENTS_GID` | Yes | High — public export of real client sheet |
| `GOOGLE_SHEETS_FORMGRID_SPREADSHEET_ID` | Yes | **Critical** — real Formgrid responses |
| `GOOGLE_DRIVE_KB_FOLDER_ID` | Yes | High — real Knowledge Base folder |
| `OPENROUTER_API_KEY` | Yes | High — billable API, may send real client context |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Yes | High — production video meetings |
| `AUTH_SECRET` | Yes | Medium — session signing for this copy |
| `AUTH_PASSWORD_*` (×4) | Yes | Medium — real team login passwords for dev |

**Not set in `.env.local` (but referenced in code / `.env.example`):**

- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_DRIVE_EMIGRANT_FOLDER_ID` (example ID still in `.env.example`)
- LiveKit Egress S3 keys
- `CRM_WRITE_*` overrides (defaults in example: write disabled)

### 2.2 Dangerous defaults in `.env.example` (committed)

These are **not secrets** but are **production identifiers** that must not be reused in Spiora:

- `GOOGLE_SHEETS_FORMGRID_SPREADSHEET_ID=1S8Y0VCaAQ78wxg5Rxl8fcFMkwSsvr-X-cLrAlK4nF9Q`
- `GOOGLE_DRIVE_EMIGRANT_FOLDER_ID=1fsL2HeiVOQHnPLFOLPROeegOpk0ZnU2X`
- Production Vercel URL in LiveKit webhook comment: `sharp-spice-team-platform.vercel.app`
- Dev passwords: `veronika-dev`, `manager1-dev`, etc.
- `OPENROUTER_APP_TITLE=Sharp & Spice Team Platform`

---

## 3. External integrations map

### 3.1 Supabase (platform)

- **Code:** `src/lib/supabase/*`, 21 SQL migrations in `supabase/migrations/`
- **Tables:** tasks, team_chat, ai_workspace_chats, client_notes, notifications, app_state, calendar, presence, meeting recordings, etc.
- **Behavior:** When `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, all persistent data goes to that project. File fallback in `.data/` is used only when Supabase is not configured.
- **Current state:** `.env.local` points to a **live Supabase project** (same as production platform).

### 3.2 Supabase (Emigrant Croatia Desk)

- **Code:** `src/lib/emigrant-desk/*`
- **Env:** `EMIGRANT_SUPABASE_URL`, `EMIGRANT_SUPABASE_SERVICE_ROLE_KEY`
- **Usage:** AI Workspace client status, Lead Review informational hints
- **Current state:** Configured in `.env.local`

### 3.3 Google Sheets (CRM + Formgrid)

- **Code:** `src/lib/google-sheets/*`, `src/lib/leads/*`
- **Modes:** Service account API **or** public CSV export by spreadsheet ID + GID
- **Fallback:** `src/lib/google-sheets/demo-data.ts` (~20 demo clients) when Sheets not configured
- **Current state:** `.env.local` has full Google credentials → **reads/writes real CRM data** (write gated by `CRM_WRITE_ENABLED`, default false in example)

### 3.4 Google Drive (Knowledge Base + Emigrant documents)

- **Code:** `src/lib/google-drive/*`
- **Usage:** KB listing, AI context from Drive files, Emigrant folder for AI
- **Current state:** KB folder ID + service account configured in `.env.local`

### 3.5 OpenRouter / OpenAI

- **Code:** `src/lib/ai/*`, `POST /api/ai-workspace`, `POST /api/clients/[id]/ai`
- **Behavior:** Sends CRM, Formgrid, KB, Emigrant Desk/Drive context to LLM when configured
- **Current state:** OpenRouter key **is set** in `.env.local`

### 3.6 LiveKit (video meetings)

- **Code:** `src/lib/calendar/meeting-*`, `src/components/meet/*`
- **API routes:** meeting-token, guest-token, webhooks
- **Current state:** LiveKit credentials **are set** in `.env.local`

### 3.7 Vercel Cron / GitHub Actions cron

- **Route:** `POST /api/cron/calendar-reminders` (protected by `CRON_SECRET`)
- **Workflow:** `.github/workflows/calendar-reminders-cron.yml`
- **Target URL hardcoded:** `https://sharp-spice-team-platform.vercel.app/api/cron/calendar-reminders`
- **Risk:** If workflow secrets are copied or cron is triggered, it hits **production deployment**

### 3.8 Webhooks

| Endpoint | Purpose |
|----------|---------|
| `/api/webhooks/livekit` | LiveKit Egress → meeting recording metadata |

Public path in middleware — must be locked down in demo mode.

### 3.9 Other API surface (59 route handlers)

Notable groups: clients CRM, tasks, team-chat (files/audio/images), calendar CRUD, notifications, presence, analytics/croatia, crm/leads, knowledge-base, meeting-recordings, settings/passwords.

---

## 4. Hardcoded production / PII in source (committed)

These exist **in git-tracked files** regardless of `.env.local`:

| Location | Issue |
|----------|-------|
| `src/lib/auth/users.ts` | Real employee names and **personal Gmail addresses** |
| `src/components/auth/DemoCredentials.tsx` | Same emails + plaintext dev passwords |
| `src/lib/brand.ts` | `Sharp & Spice`, production marketing URL |
| `src/app/layout.tsx`, `public/manifest.json` | Brand metadata, `lang="ru"`, theme `#910D0D` |
| `src/lib/auth/permissions.ts` | Nav label «Сайт Sharp & Spice», relocation-specific modules |
| `src/lib/calendar/meeting.test.ts` | Room prefix `sharp-spice-cal-` |
| `CRM_DEDUP_GAP_ANALYSIS.md` and other docs | Real client names, emails, passport/case numbers |
| `.env.example` | Production spreadsheet/folder IDs |
| `src/components/knowledge-base/KnowledgeBaseView.tsx` | Example service account email in UI |
| `src/lib/google-sheets/demo-data.ts` | Demo CRM data references «Вероника», real-looking passport numbers |

**Finding:** Even with env isolation, running `npm run dev` today could expose real identities in login UI (dev mode) and AI could ingest real client data.

---

## 5. What is still linked to production

| Link type | Severity | Action required |
|-----------|----------|-----------------|
| Git remote → `Sharp-Spice-Team-Platform` | **Critical** | Remove remote; new repo `spiora-demo` (Stage 1) |
| `.env.local` Supabase keys | **Critical** | Replace with Spiora-only project; never commit |
| `.env.local` Google SA + sheet/folder IDs | **Critical** | Disable; use mock/demo seed only |
| `.env.local` Emigrant Supabase | **Critical** | Disable entirely in demo |
| `.env.local` OpenRouter key | High | Separate Spiora key with limits, or demo mock AI |
| `.env.local` LiveKit | High | Separate project or demo stub |
| GitHub cron workflow URL | High | Delete or repoint to Spiora deployment only |
| Hardcoded team emails in source | **Critical** | Replace with fictional demo accounts before any public demo |
| Internal docs with real PII | Medium | Exclude from demo repo or redact |
| Package name / branding | Medium | Rebrand in Stage 3 |

---

## 6. Integrations to disable for Spiora demo

| Integration | Demo strategy |
|-------------|---------------|
| Production Supabase | New Spiora Supabase only + URL guard |
| Emigrant Desk Supabase | Off; remove from AI context in demo mode |
| Google Sheets CRM | Off; use `seed-data` / Supabase seed |
| Google Drive KB/Emigrant | Off; static KB articles in seed |
| Formgrid / Lead write path | Off or mock queue from seed |
| OpenRouter | Separate key + rate/cost limits, or canned responses |
| LiveKit | Separate project or UI demo state without real rooms |
| Cron (GitHub → Vercel) | Disable until Spiora deployment + new secret |
| CRM write (`CRM_WRITE_ENABLED`) | Must stay `false` in demo |
| Email / SMS / WhatsApp | Not implemented today — keep disabled |
| `/api/ai-workspace/clients-diagnostic`, `sheets-health` | Restrict to owner or disable in demo |

---

## 7. Data that could leak into demo

1. **CRM clients** — via Google Sheets if env is loaded  
2. **Formgrid leads** — same  
3. **Emigrant Desk cases** — via Emigrant Supabase + AI prompts  
4. **Drive documents** — KB and Emigrant folder  
5. **Supabase rows** — tasks, chat, calendar, notifications from production project  
6. **Team identities** — hardcoded in auth module  
7. **Meeting recordings** — LiveKit Egress → Supabase Storage on production bucket  
8. **AI chat history** — stored in Supabase `ai_workspace_chats` or `.data/`

Local `.data/` directory (gitignored) may also contain persisted JSON from prior runs on this machine.

---

## 8. Safe to begin changes?

| Question | Answer |
|----------|--------|
| Safe to `git push`? | **No** — pushes to production repo |
| Safe to `npm run dev` with current `.env.local`? | **No** — connects to live Supabase, Google, OpenRouter, LiveKit |
| Safe to edit code in this folder? | **Yes**, if user confirms this IS the Spiora folder (not the original) |
| Safe to commit secrets? | **No** — verify `.env.local` never staged |
| Safe to start Stage 1 (git isolation)? | **Yes**, after user confirms audit — no code/env changes in Phase A |

### Recommended order before any demo run

1. Complete **Stage 1** — detach git remote, initial commit to `spiora-demo`  
2. **Replace `.env.local`** with Spiora-only empty/template values (Stage 2)  
3. Implement **`SPIORA_DEMO_MODE=true`** guards before running dev server  
4. Replace hardcoded users in `users.ts` with fictional accounts  
5. Create demo Supabase and run seed migrations  

---

## 9. Phase A compliance

| Rule | Status |
|------|--------|
| No code changes | ✅ |
| No `.env` modifications | ✅ |
| No git remote removal | ✅ |
| No Supabase / migrations | ✅ |
| No commit / push / deploy | ✅ |

---

## 10. Summary verdict

**Isolation status: FAILED (pre-remediation)**

The folder is a git-linked copy of the production platform with a populated `.env.local` pointing at live infrastructure and hardcoded real team identities in source. Spiora work must treat this environment as **contaminated** until Stages 1–2 are complete and demo guards are in place.

**Next step:** User confirmation → **Stage 1 (Git isolation)** per `SPIORA_IMPLEMENTATION_PLAN.md`.
