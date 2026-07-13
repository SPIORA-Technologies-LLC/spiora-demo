# SPIORA — Security Gap Report

**Дата:** 11 июля 2026  
**PR:** #10 Full Demo Readiness Audit  
**Baseline:** `PLATFORM_SECURITY_AUDIT.md` (2026-06-17) + изменения PR #6–#9

**Scope:** публичная demo-среда (`SPIORA_DEMO_MODE=true`, интеграции off).  
**Действие:** только документирование — исправления не выполнялись.

---

## Executive summary

| Метрика | Значение |
|---------|----------|
| **Critical (demo-relevant)** | **1** |
| **High** | **8** |
| **Medium** | **12** |
| **Low / mitigated** | **14** |
| **Исправлено с baseline** | F-08 (KB folderId), demo guards, AI/chat rate limits |

Demo mode **существенно снижает** blast radius (Google/Supabase/LiveKit/AI off), но архитектурные риски остаются при misconfiguration или включении интеграций.

---

## Critical

| ID | Область | Находка | Demo impact | Рекомендация |
|----|---------|---------|-------------|--------------|
| **S-C1** | Google Sheets | Публичный CSV export CRM обходит auth платформы (F-01) | 🔴 если `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=true` | Никогда не включать prod Sheets в public demo; отдельный demo sheet |

---

## High

| ID | Область | Находка | Demo impact | Статус / рекомендация |
|----|---------|---------|-------------|----------------------|
| **S-H1** | Supabase RLS | 0 RLS policies во всех миграциях (F-03) | При demo Supabase — full DB access via service role | PR #14: RLS + demo project |
| **S-H2** | Service role | `SUPABASE_SERVICE_ROLE_KEY` bypasses all ACL (F-04) | Secret leak = total compromise | Separate demo project, rotate keys |
| **S-H3** | API RBAC | `/api/*` не в middleware; большинство routes — any auth user (F-05) | Manager может вызывать owner APIs если знает URL | Central API RBAC middleware |
| **S-H4** | CRM write | `PATCH /api/crm/leads/[id]` → create_in_crm для любого manager (F-06) | Low if Sheets off; High if enabled | Demo guard + owner-only |
| **S-H5** | TLS | `rejectUnauthorized: false` на Google HTTPS (F-02) | MITM при включении Google | Fix TLS in PR #11 |
| **S-H6** | Debug API | `clients-diagnostic` — PII samples (F-09) | 🔴 if `SPIORA_AI_WORKSPACE_DEBUG=true` | Remove from prod build or hard block in demo |
| **S-H7** | Debug chat | `/debug_client` in AI — raw CRM scan (F-10) | Any auth user | Disable in demo mode |
| **S-H8** | Auth | No rate limit / lockout on login (F-17) | Brute force on 4 demo accounts | PR #11: login rate limit |

### Исправлено / mitigated

| ID | Находка | Fix |
|----|---------|-----|
| ~~F-08~~ | KB arbitrary folderId | ✅ Whitelist in `kb-drive.ts` (PR #9) |
| F-21 partial | AI abuse | ✅ Demo rate limits (`workspace-demo-rate-limit.ts`) |
| Team chat abuse | — | ✅ Demo rate limits (`demo-rate-limit.ts`) |
| Admin mutations | — | ✅ `demo-guard.ts` blocks delete/reset/settings |
| KB writes | — | ✅ Read-only + POST 403 |
| Debug APIs | — | ✅ Gated by `SPIORA_AI_WORKSPACE_DEBUG` |
| Cron/webhooks | — | ✅ 503 unless explicitly enabled |
| Integrations | — | ✅ `integration-policy.ts` killswitch |
| Environment | — | ✅ `environment-guard.ts` blocked IDs |

---

## Medium

| ID | Область | Находка |
|----|---------|---------|
| S-M1 | Middleware gap | New API route without `getSession()` not blocked (F-14) |
| S-M2 | Settings page | Owner check via middleware only, not server page guard (F-15) |
| S-M3 | OpenRouter | Client notes/internal fields in LLM context (F-13) — mitigated if external AI off |
| S-M4 | JWT session | 7-day cookie, no rotation/revoke (F-18) |
| S-M5 | Guest meet | Public token APIs — enumeration/brute force on invite tokens |
| S-M6 | Uploads | Task/chat attachments — type/size limits exist but no global upload policy doc |
| S-M7 | `.data/` filesystem | Path traversal mitigated by ID routes; but no virus scan |
| S-M8 | CSP | No Content-Security-Policy header configured |
| S-M9 | CORS | Default Next.js — no explicit hardening documented |
| S-M10 | Source maps | Production build may expose maps depending on deploy config |
| S-M11 | Emigrant Desk | Second service role key expands blast radius (F-11) |
| S-M12 | Analytics API | `/api/analytics/croatia` owner-only ✅ but `/api/analytics/overview` demo-only ✅ |

---

## Low

| ID | Находка | Notes |
|----|---------|-------|
| S-L1 | Plain-text AUTH_PASSWORD in env supported (F-12) | Demo uses env passwords |
| S-L2 | `.env.example` template clean | ✅ No prod IDs in repo |
| S-L3 | Demo credentials UI | Shown when `NODE_ENV !== production` |
| S-L4 | Session cookie | httpOnly, secure in prod, sameSite lax (F-25) |
| S-L5 | Notifications scoping | user_id filter (F-28) |
| S-L6 | AI chats scoping | session.id filter (F-27) |
| S-L7 | CRM write dry-run defaults | F-22 mitigation |
| S-L8 | AI off-topic guardrails | `workspace-off-topic.ts` |
| S-L9 | Demo context redaction | `workspace-demo-safe.ts` |
| S-L10 | KB XSS | react-markdown + safe href (PR #9) |
| S-L11 | Cron auth | Bearer CRON_SECRET verified |
| S-L12 | Webhook auth | LiveKit signature verification |
| S-L13 | No custom error pages | Default Next errors — no stack in UI |
| S-L14 | `/api/locale` unauthenticated | Low risk — cookie only |

---

## Checklist: публичная demo как враждебная среда

| Проверка | Статус |
|----------|--------|
| Auth required on pages | ✅ middleware |
| Auth required on APIs | ✅ per-route (no global middleware) |
| RBAC on sensitive APIs | ⚠️ partial |
| RLS | ❌ |
| Service role isolated | ⚠️ depends on deploy |
| Rate limiting | ⚠️ AI + chat only |
| Brute force login | ❌ |
| Uploads safe types/limits | ⚠️ per-module |
| XSS | ✅ mostly safe; Tasks/meet unreviewed |
| Path traversal | ✅ ID-based routes |
| Arbitrary IDs | ✅ KB fixed; calendar/task by ACL |
| ID enumeration | ⚠️ guest tokens, client IDs predictable in demo |
| Debug endpoints | ⚠️ env-gated |
| Raw errors to client | ✅ generic in most APIs |
| Secrets in source/reports | ✅ clean post-sanitization |
| Browser console leaks | ⚠️ not audited runtime |
| CSP | ❌ |
| Webhook auth | ✅ when enabled |
| Cron auth | ✅ when enabled |
| LiveKit token API | ✅ session + meeting access |
| AI prompt injection | ⚠️ off-topic guard; no full sandbox |
| Demo reset permissions | N/A — reset not implemented |

---

## Приоритет исправлений (для PR #11)

1. Login rate limiting  
2. Block debug endpoints entirely in demo (not just hide)  
3. TLS `rejectUnauthorized` fix for Google  
4. API RBAC for owner-only routes  
5. Demo guard on CRM lead write  
6. CSP baseline header  

---

## SAFE / NOT SAFE для public deploy (security lens)

| | |
|--|--|
| **SAFE with default demo env** | Integrations off, DEBUG off, no prod credentials |
| **NOT SAFE if** | Google/Supabase prod enabled, DEBUG on, weak AUTH_SECRET, no login rate limit |
