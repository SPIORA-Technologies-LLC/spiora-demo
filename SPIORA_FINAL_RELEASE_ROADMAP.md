# SPIORA — Final Release Roadmap

**Дата:** 11 июля 2026  
**PR:** #10 Full Demo Readiness Audit  
**Текущий commit:** `ba7ce4b` (PR #9)

---

## Текущее состояние

| PR | Commit | Статус |
|----|--------|--------|
| #1–#6 | `dc551f9`…`8e29a7a` | Isolation, i18n foundation, core modules, AI demo |
| #7 | `96813fa` | Team Chat + Notifications |
| #8 | `4b67154` | Analytics + Team + Settings |
| #9 | `ba7ce4b` | Knowledge Base |
| **#10** | — | **Audit only (этот документ)** |

**Общая готовность к public demo:** **~68%** (см. `SPIORA_FULL_DEMO_READINESS_AUDIT.md`)

**Оценка до public deploy:** **4–6 недель** (1 FTE) · **3–4 недели** (2 FTE parallel)

---

## PR #11 — Critical Fixes

| | |
|--|--|
| **Scope** | Tasks i18n (~120 keys); nav hardcoded RU → i18n; login rate limit; block debug endpoints in demo; TLS fix; CRM lead write demo guard; custom `not-found.tsx` / `error.tsx`; calendar seed requires demo flag |
| **Risks** | Tasks — largest unmigrated module; middleware changes |
| **Dependencies** | PR #10 audit |
| **Estimate** | **5–7 дней** |
| **Done when** | Demo path EN/RU without Cyrillic leak; 0 Critical security in default demo env; tests pass; build green |

---

## PR #12 — Unified Demo Seed

| | |
|--|--|
| **Scope** | `seedDemoPlatformIfNeeded()` orchestrator; demo tasks (8–12); 2 AI saved chats; align Croatia direction filter; idempotent seed per module; seed manifest JSON |
| **Risks** | Seed order dependencies; stale `.data/` conflicts |
| **Dependencies** | PR #11 Tasks i18n |
| **Estimate** | **4–6 дней** |
| **Done when** | Fresh install shows full demo on first login; all 12 modules non-empty; EN/RU seeds |

---

## PR #13 — Demo Reset

| | |
|--|--|
| **Scope** | `POST /api/demo/reset` (owner-only); clear `.data/` + reseed; optional `?module=` partial reset; UI button in Settings (owner, demo badge); rate limit 1/hour |
| **Risks** | Accidental reset; concurrent requests |
| **Dependencies** | PR #12 unified seed |
| **Estimate** | **3–4 дня** |
| **Done when** | Reset restores canonical demo; smoke test EN/RU |

---

## PR #14 — Demo Supabase

| | |
|--|--|
| **Scope** | New Supabase project; migrations; RLS deny-all + service role only; env template; toggle `SPIORA_ENABLE_SUPABASE=true` for Vercel; migrate stores from `.data/` to Supabase repos |
| **Risks** | Cost; migration bugs; service role leak |
| **Dependencies** | PR #12 seed data spec |
| **Estimate** | **5–8 дней** |
| **Done when** | Deploy survives redeploy; data persists; blocked prod refs validated |

---

## PR #15 — Guided Demo / Welcome

| | |
|--|--|
| **Scope** | Welcome modal on first login; 5-step tour (Dashboard → Clients → AI → Calendar → KB); suggested demo script EN/RU; owner/manager role hints; skip/dismiss |
| **Risks** | UX annoyance; mobile tour layout |
| **Dependencies** | PR #11–#12 stable demo path |
| **Estimate** | **4–5 дней** |
| **Done when** | New user completes tour; links work; localized |

---

## PR #16 — Release Preparation

| | |
|--|--|
| **Scope** | GitHub repo `spiora-demo`; Vercel project; env vars; `NEXT_PUBLIC_SPIORA_DEMO_MODE`; smoke test checklist; README deploy guide; hide internal nav items; performance pass; final security scan |
| **Risks** | Credential misconfiguration; accidental prod linkage |
| **Dependencies** | PR #11–#14 |
| **Estimate** | **3–5 дней** |
| **Done when** | Public URL live; smoke 11-step path pass; no secrets in logs |

---

## Post-release (Future)

| Item | PR / track |
|------|------------|
| LiveKit demo room polish | Future |
| Meet in-room i18n | #11 follow-up |
| Lead Review / Formgrid i18n or hide | Optional |
| Week view calendar | Future |
| WhatsApp / Gmail / Stripe | Future |
| Recording playback demo | Future + LiveKit |

---

## GitHub setup (PR #16)

1. Create `spiora-demo` repository (private → public when ready)
2. Branch protection on `main`
3. No production remotes in local clone
4. GitHub Actions: `npm test` + `npm run build` on PR
5. Secret scanning enabled

---

## Vercel setup (PR #16)

| Env var | Value |
|---------|-------|
| `SPIORA_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_SPIORA_DEMO_MODE` | `true` |
| `AUTH_SECRET` | generated |
| `AUTH_PASSWORD_*` | demo passwords |
| `SPIORA_ENABLE_SUPABASE` | `true` (after #14) |
| All `SPIORA_ENABLE_*` else | `false` |
| `SPIORA_BLOCKED_*` | prod IDs |

**Region:** EU (if GDPR relevant)  
**Preview deployments:** disabled or password-protected

---

## Public smoke test checklist

1. Login EN → Dashboard loads with demo badge  
2. Clients → 12 demo clients  
3. Client card → notes, AI panel  
4. Calendar → events visible  
5. AI Workspace → canned response  
6. Team Chat → 27 messages  
7. Knowledge Base → search EN  
8. Switch RU → no English UI leak on above  
9. Analytics (owner) → overview KPIs  
10. Team → 4 members online  
11. Settings → integrations disabled messages  
12. Reset (after #13) → canonical state  

---

## Timeline (Gantt summary)

```
Week 1–2:  PR #11 Critical Fixes
Week 2–3:  PR #12 Unified Seed
Week 3:    PR #13 Reset
Week 4–5:  PR #14 Demo Supabase
Week 5:    PR #15 Guided Demo
Week 6:    PR #16 Release + smoke test
```

**Earliest public demo:** ~6 weeks from audit date (mid-August 2026)  
**Conservative:** ~8 weeks with review cycles

---

## Рекомендуемый следующий PR

**PR #11 — Critical Fixes** (Tasks i18n + security hardening + nav localization)

**Обоснование:** Tasks — единственный модуль core demo path без локализации; login brute force — High; debug endpoints — misconfiguration risk.
