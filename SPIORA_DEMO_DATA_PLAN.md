# SPIORA Demo Data Plan — Phase A

**Date:** 2026-07-10  
**Demo company (proposed):** **Northstar Mobility**  
**Tagline EN:** Corporate Digital Workspace  
**Tagline RU:** Корпоративное цифровое пространство  

---

## 1. Goals

1. Every module shows **realistic, populated** UI — no empty charts or blank chat  
2. **Zero** real client/employee PII from Sharp & Spice production  
3. Data survives refresh via **Spiora-only Supabase** (not Google Sheets)  
4. **Reset demo data** restores baseline seed (Stage 6)  
5. Passport/ID formats clearly fictional: `DEMO-P12345`, `DEMO-1001`

---

## 2. Current data sources (baseline)

| Module | Current source | Production risk today |
|--------|----------------|----------------------|
| CRM clients | Google Sheets **or** `demo-data.ts` (~20 clients) | High when Sheets configured |
| Client detail/docs/notes | Sheets ranges + Supabase `client_notes` | High |
| Tasks | Supabase `tasks` or `.data/` JSON | High if prod Supabase |
| Team chat | Supabase `team_chat_messages` | High |
| Calendar | Supabase `calendar_events` + related | High |
| Notifications | Supabase `notifications` | High |
| AI chats | Supabase `ai_workspace_chats` | High |
| Knowledge Base | Google Drive folder | High |
| Analytics | Google Sheets + Croatia supplement APIs | High |
| Leads / Formgrid | Google Sheets Formgrid + Lead Review store | High |
| Emigrant Desk | External Supabase | High |
| Team roster | Hardcoded `users.ts` | **Real emails in source** |
| Presence | Supabase `user_presence` | Medium |

**Existing demo seed:** `src/lib/google-sheets/demo-data.ts` — 20 clients, Russian names, references «Вероника», mixed EU phones, some passport-like numbers. **Must be replaced** for Spiora (fictional names, `example.com`, `DEMO-*` IDs).

---

## 3. Target architecture

```text
supabase/
  seed/
    001_demo_users.sql          # optional if auth stays env-based
    002_demo_clients.sql        # if clients move to Supabase
    003_demo_tasks.sql
    004_demo_calendar.sql
    005_demo_notifications.sql
    006_demo_chat.sql
    007_demo_ai_chats.sql
    008_demo_analytics_snapshots.sql
    009_demo_kb_articles.sql

src/lib/demo/
  seed-data.ts                  # TypeScript mirror / generator for file fallback
  seed-runner.ts                # idempotent upsert logic
  reset-demo.ts                 # owner-only reset orchestration
  ai-responses.ts               # canned AI for demo mode
  constants.ts                  # company name, timezone
```

### 3.1 Primary store: Spiora Supabase

Use existing tables from `supabase/migrations/*.sql` — no schema fork required initially.

| Table | Seed content |
|-------|--------------|
| `tasks` | 25–40 tasks across statuses |
| `team_chat_messages` | 18–25 messages, 3–4 threads |
| `notifications` | 12–20 items per demo user |
| `calendar_events` | 30–50 events (personal, team, video, deadlines) |
| `ai_workspace_chats` | 2–3 sample conversations per role |
| `client_notes` | 2–4 notes per featured client |
| `app_state` | demo metadata, reset version counter |

### 3.2 CRM clients: migration decision

**Option A (recommended for demo):** Keep clients in **TypeScript seed** (`seed-data.ts`) + optional Supabase `demo_clients` table added in new migration.

**Option B:** Extend Google Sheets mock — **reject** for Spiora (disable Google entirely).

**Recommendation:** Option A — `src/lib/demo/seed-data.ts` becomes single source; `google-sheets/service.ts` reads from demo module when `SPIORA_DEMO_MODE=true`.

Target: **20–30 clients** (expand from current 20).

---

## 4. Fictional personas

### 4.1 Demo company staff (replace `users.ts`)

| Name | Role | Email | Password |
|------|------|-------|----------|
| Olivia Bennett | owner | `olivia.bennett@northstarmobility.example.com` | env: `AUTH_PASSWORD_OWNER` |
| Daniel Cooper | manager | `daniel.cooper@northstarmobility.example.com` | env: `AUTH_PASSWORD_MANAGER_1` |
| Emma Wilson | manager | `emma.wilson@northstarmobility.example.com` | env: `AUTH_PASSWORD_MANAGER_2` |
| Lucas Martin | manager | `lucas.martin@northstarmobility.example.com` | env: `AUTH_PASSWORD_MANAGER_3` |

Passwords: generated per environment, **never** in public source. Login page: **Try as Owner / Try as Manager** one-click (session bootstrap API, rate-limited).

Optional view-only: `alex.viewer@northstarmobility.example.com`.

### 4.2 Demo clients (sample set)

| Name | Client ID | Email | Phone | Status |
|------|-----------|-------|-------|--------|
| John Carter | DEMO-1001 | john.carter@example.com | +000 000 000 001 | Active |
| Sofia Martins | DEMO-1002 | sofia.martins@example.com | +000 000 000 002 | Consultation |
| Anna Kowalska | DEMO-1003 | anna.kowalska@example.com | +000 000 000 003 | Documents |
| Marco Rossi | DEMO-1004 | marco.rossi@example.com | +000 000 000 004 | In progress |
| Emily Brown | DEMO-1005 | emily.brown@example.com | +000 000 000 005 | Completed |

… expand to 20–30 with varied directions (EU mobility themes), managers assigned to Daniel/Emma/Lucas.

**Passport format:** `DEMO-P12345` only.

---

## 5. Module-by-module seed specification

### 5.1 CRM (15–30 clients)

- Statuses: New, Consultation, In progress, Documents, Waiting, Completed, On hold  
- Directions: Portugal, Croatia, Spain, Slovakia, Germany (fictional pipeline labels)  
- Managers: demo staff names  
- Dates: relative to seed run date (`T-7`, `T+14` days)  
- Include 5 “featured” clients for AI/tour prompts (Sofia Martins, John Carter, etc.)

### 5.2 Tasks (25–40)

| Status | Count | Notes |
|--------|-------|-------|
| new | 6–8 | Unassigned + assigned |
| in_progress | 10–12 | Mixed assignees |
| review / on_review | 4–6 | If workflow supports |
| completed | 8–10 | Last 30 days |
| overdue | 4–6 | Due date in past |

Include progress reports on 3–5 tasks.

### 5.3 Calendar (30–50 events)

- Personal events for each demo user  
- Company all-hands (1)  
- Client consultations (8–10)  
- Team meetings (6–8)  
- Video meetings (4–6) with `meeting_link` stub or demo LiveKit room  
- Deadlines (5–8)  

Layer types: match existing calendar layer filters.

### 5.4 Notifications (12–20 per owner, fewer for managers)

Types already in codebase:

- New calendar event  
- Reminder approaching  
- New task assignment  
- New document (simulated)  
- Team chat mention  

Use `src/lib/notifications/labels.ts` keys after i18n.

### 5.5 Team Chat (15–20 messages)

Realistic professional tone, no sensitive topics:

```
Olivia: Team — Q3 pipeline review moved to Thursday 10:00.
Daniel: Updated the Carter file — missing proof of address.
Emma: @Lucas can you cover the Martins consultation tomorrow?
...
```

Include: 1 pinned message, 1 reply thread, 1 link to internal KB article slug.

### 5.6 Knowledge Base (8–12 articles)

Stored in Supabase `app_state` or new `kb_articles` table if needed:

| Slug | Title |
|------|-------|
| onboarding | New employee onboarding |
| client-workflow | Client intake workflow |
| document-checklist | Standard document checklist |
| consultation-prep | Preparing for consultations |
| internal-communication | Team communication guidelines |

Content: 3–8 paragraphs markdown, fictional procedures referencing Northstar Mobility.

**Disable Google Drive KB** in demo mode.

### 5.7 Analytics

Pre-computed snapshot JSON in `app_state` or dedicated table:

- Lead funnel (fictional counts)  
- Clients by status (pie)  
- Tasks completed per week (12 weeks)  
- Consultations per month  
- Manager workload comparison  

Ensure charts never empty on first load.

**Disable** `/api/analytics/croatia` production paths or replace with demo snapshot.

### 5.8 AI Workspace

- **Prepared prompts** (EN/RU) per Stage 9 spec  
- **Canned responses** in `ai-responses.ts` keyed by intent:
  - `priorities_today`
  - `find_client_sofia`
  - `document_checklist`
  - `overdue_tasks`
- 2 saved chat sessions in `ai_workspace_chats` with realistic Q&A  

When `OPENROUTER_API_KEY` absent or `SPIORA_DEMO_MODE=true` + rate limit hit → serve canned responses.

### 5.9 Leads / Formgrid (demo scope)

**Recommendation for demo:** Replace with **mock lead queue** (5–8 pending leads) in seed data; hide write-to-CRM actions.

Modules «Эмиграция», «Чекапы в Ереване», Emigrant Desk — **hide from nav** or show static “Demo module” placeholder unless product decision keeps relocation vertical for Spiora marketing.

### 5.10 Meeting recordings

3 fictional recordings metadata rows:

- Title, duration, date, linked calendar event  
- Playback: demo video stub or “Recording available in full deployment” message  

---

## 6. Seed execution

### 6.1 Idempotency

```ts
// seed-runner.ts pseudocode
const DEMO_SEED_VERSION = "2026-07-10.1";

async function runSeed(force = false) {
  const state = await getAppState("demo_seed");
  if (state?.version === DEMO_SEED_VERSION && !force) return;
  await upsertClients(DEMO_CLIENTS);
  await upsertTasks(DEMO_TASKS);
  // ...
  await setAppState("demo_seed", { version: DEMO_SEED_VERSION, seededAt: new Date() });
}
```

### 6.2 Triggers

| When | Action |
|------|--------|
| First deploy to empty Spiora DB | Run SQL seed + app_state marker |
| Owner clicks **Reset demo data** | `POST /api/demo/reset` → truncate demo tables → re-run seed |
| Visitor session | Never auto-reset |

### 6.3 What reset clears

- Tasks, chat, notifications, calendar, AI chats, client notes, visitor-uploaded files  
- **Does not clear:** demo user passwords, env config, branding  

---

## 7. Data Spiora must NOT contain

- Real Sharp & Spice employee emails (currently in `users.ts`)  
- Real Gmail addresses from `DemoCredentials.tsx`  
- Production spreadsheet / Drive IDs  
- Real passport numbers from `CRM_DEDUP_GAP_ANALYSIS.md`  
- Emigrant Desk case numbers  
- `sharp-spice.com` emails  
- Production Vercel URLs in seeded links  

---

## 8. SQL vs TypeScript seed

| Approach | Pros | Cons |
|----------|------|------|
| SQL files in `supabase/seed/` | Easy DBA review, one-shot on new project | Harder to maintain complex nested JSON |
| TS `seed-data.ts` + runner | Type-safe, shares types with app | Requires API route or script to execute |

**Hybrid (recommended):**

- Static reference data (clients, KB markdown) in TS  
- Runner script: `npm run demo:seed` (to be added in PR #5)  
- Optional SQL export for documentation  

---

## 9. Acceptance criteria (PR #5)

- [ ] 20+ clients, all `DEMO-*` / `@example.com`  
- [ ] 4 demo staff accounts; no real emails in repo  
- [ ] Tasks, calendar, chat, notifications populated on fresh Spiora Supabase  
- [ ] Analytics charts render with non-zero data  
- [ ] AI demo prompts return canned answers without OpenRouter  
- [ ] Reset restores counts to baseline within 60s  
- [ ] Second seed run creates no duplicates  
- [ ] Google Sheets/Drive return disabled / mock in demo mode  

---

## 10. Effort estimate

| Task | Days |
|------|------|
| Design seed schemas + fictional content | 2 |
| Implement `seed-data.ts` + runner | 3 |
| Supabase migration/seed SQL | 1 |
| Wire demo mode to bypass Google | 2 |
| Reset API + owner guard | 1 |
| Analytics/KB/AI canned content | 2 |
| Tests (seed idempotency, reset) | 1 |
| **Total PR #5** | **~12 dev-days** |
