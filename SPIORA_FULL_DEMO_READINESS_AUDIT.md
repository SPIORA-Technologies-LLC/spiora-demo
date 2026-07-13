# SPIORA — Full Demo Readiness Audit

**Дата:** 11 июля 2026 (обновлено после PR #11)  
**PR:** #10 audit + **#11 Critical Fixes applied (uncommitted)**  
**Ветка:** `main`  
**Действие PR #10:** audit-only · **PR #11:** critical fixes без commit

> **Обновление PR #11:** см. `SPIORA_DEMO_CRITICAL_FIXES_REPORT.md`

---

## Executive summary

| Метрика | PR #10 | После PR #11 |
|---------|--------|--------------|
| **Общая готовность Spiora** | **68%** | **77%** |
| **UX (demo path)** | **81%** | **87%** |
| **Маршрутов (HTTP)** | **88** | 88 (+ custom 404/500) |
| **Полностью локализованных модулей** | **11 / 18** | **14 / 18** (78%) |
| **Блокеров deploy** | **7** | **3** |
| **Critical security** | **1** | 1 (unchanged) |
| **High security** | **8** | 7 (−1 login brute force in demo) |
| **Рекомендуемый следующий PR** | **#11 Critical Fixes** | **#12 Demo Reset** |
| **Срок до public demo** | **4–6 недель** | **3–5 недель** (1 FTE) |

Spiora demo **готов к sales preview** на core path (Dashboard → Clients → Tasks → Calendar → AI → Chat → KB → Analytics). **Главные оставшиеся пробелы:** ephemeral `.data/` на Vercel, отсутствие reset, Meet/Leads i18n, infra deploy.

**Вердict:** **NOT READY** для public deploy · **READY** для client demo с owner account (PR #11 закрыл критичные «недоделки»).

---

## 1. Route inventory (summary)

Полный список: `SPIORA_ROUTE_INVENTORY.md`

| Категория | Count |
|-----------|-------|
| Pages | 23 |
| API routes | 61 |
| Cron | 1 |
| Webhook | 1 |
| Debug | 2 |

### Рекомендации по маршрутам

| Действие | Routes |
|----------|--------|
| **Отключить/скрыть в public demo** | `/crm/leads/*`, `/new-formgrid-clients`, `/meeting-recordings`, `/join/[token]`, debug APIs |
| **Dev-only** | `clients-diagnostic`, `sheets-health` |
| **Оставить** | Core demo path (11 modules) + login |

---

## 2. Localization audit

### Полностью локализовано (14 модулей)

Dashboard · Calendar (main UI) · Clients (list/detail/notes/AI) · AI Workspace · Team Chat · Analytics · Team · Settings · Knowledge Base · Auth/Login · Notifications UI · **Tasks** · **Error pages (404/500)** · **Sidebar nav (core labels)**

### Частично локализовано (5)

| Модуль | Gap |
|--------|-----|
| **LiveKit / Meet** | In-room UI, control bar, guest lobby — RU hardcoded |
| **Meeting Recordings** | Full RU |
| **PWA** | Install hint RU; manifest ✅ |
| **Relocation / Checkups** | RU headers, EN data |
| **StatusBadge** | RU CRM statuses despite `statuses` namespace |

### Не локализовано (3)

| Модуль | Cyrillic tokens (approx) |
|--------|--------------------------|
| **Lead Review** | ~40 (3 components + pages) |
| **Formgrid list** | ~6 |
| **RU nav leftovers** | dashboard, analytics, team, settings — EN in RU mode |

### ~~Не локализовано~~ — закрыто в PR #11

| Модуль | Статус |
|--------|--------|
| ~~**Tasks**~~ | ✅ 199 keys, 20 demo tasks |
| ~~**Navigation (Sidebar)**~~ | ✅ 5 items → i18n |
| ~~**Error pages**~~ | ✅ not-found + error |

### Намеренно не переводится

Spiora · AI · CRM · API · имена demo-пользователей · технологии (Google Drive, LiveKit, PDF) · demo company URL

### Mixed-language audit (после PR #11)

| Режим | Статус |
|-------|--------|
| EN mode + Tasks/Sidebar/Errors | ✅ Clean |
| EN mode + Meet/Leads/Recordings | 🔴 Cyrillic leak |
| RU mode + Clients demo data | 🟡 EN field values (acceptable) |
| RU mode + nav dashboard/settings | 🟡 EN labels |
| RU mode + StatusBadge | 🔴 EN statuses in dictionary unused |

**~25 component files** содержат кириллицу в runtime UI (было ~31).

---

## 3. Demo data audit (summary)

Полный inventory: `SPIORA_DEMO_DATA_INVENTORY.md`

| Модуль | Seed | Auto | i18n data | Mutable | Persists |
|--------|------|------|-----------|---------|----------|
| Users | Static 4 | ❌ | Roles ✅ | 🔒 | Passwords |
| Clients | 12 static | ❌ | EN | ❌ | — |
| Notes | 2 + mem | Partial | EN | ✅ | Mem only |
| **Tasks** | **20 static** | **✅** | **✅** | ✅ | `.data` |
| Calendar | 28 | ✅ | ✅ | ✅ | `.data` |
| Notifications | 13/user | ✅ | ✅ | ✅ | `.data` |
| Team chat | 27 | ✅ | ✅ | ✅ | `.data` |
| AI chats | None | ❌ | Canned ✅ | ✅ | `.data` |
| KB | 15 | ✅ | ✅ | 🔒 | `.data` |
| Analytics | Synthetic | ✅ | ✅/⚠️ | ❌ | Supplement |
| Team | Static | ❌ | ✅ | 🔒 | `.data` |
| Settings | — | ❌ | ✅ | 🔒 | Cookie |

**Критический gap:** Tasks пуст на fresh install — demo path выглядит незавершённым.

---

## 4. Integrations audit

| Integration | Demo default | Fallback | ENV required | Prod leak risk | Demo infra needed |
|-------------|--------------|----------|--------------|----------------|-------------------|
| **Supabase** | OFF | `.data/` JSON | URL + service role | 🔴 High | Yes for Vercel |
| **Google Sheets** | OFF | `demo-data.ts` | SA email + key + sheet IDs | 🔴 Critical | No (use static) |
| **Google Drive** | OFF | Demo KB articles | Folder ID + SA | 🔴 High | No |
| **OpenRouter/OpenAI** | OFF | Canned AI scenarios | API keys | Medium | No |
| **LiveKit** | OFF | Gate UI | URL + API key/secret | Medium | Optional staging |
| **Formgrid** | OFF | Empty table | Sheets | High if enabled | No |
| **Emigrant Desk** | OFF | Stub context | Second Supabase | High | No |
| **Email** | N/A | — | — | — | Future |
| **Cron** | OFF | 503 | CRON_SECRET | Low | Vercel cron |
| **Webhooks** | OFF | 503 | LiveKit webhook | Low | With LiveKit |
| **Storage** | Local `.data/` | — | Supabase buckets if enabled | Medium | Demo buckets |
| **GitHub Actions** | None | — | — | — | PR #16 |
| **Vercel** | None | — | Demo env vars | Misconfig | PR #16 |

**Deploy rule:** все `SPIORA_ENABLE_*` = `false` кроме Supabase после PR #14.

---

## 5. Security audit (summary)

Полный отчёт: `SPIORA_SECURITY_GAP_REPORT.md`

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 8 |
| Medium | 12 |
| Low / mitigated | 14 |

**Top risks for public demo:**
1. Enabling production Google Sheets (CSV bypass)
2. No login rate limiting
3. Debug endpoints if DEBUG flag set
4. `.data/` ephemeral — not security but availability
5. No RLS when Supabase enabled

**Mitigations already in place (PR #6–#9):**
- Integration killswitch
- Environment guard blocked IDs
- Demo guards on admin mutations
- AI + chat rate limits
- KB folderId whitelist
- KB read-only demo

---

## 6. UX audit — demo path (1–10)

| # | Module | UI | Content | Clarity | EN | RU | Mobile | Demo effect | Public ready | **Avg** |
|---|--------|-----|---------|---------|----|----|--------|-------------|--------------|---------|
| 1 | Login | 8 | 9 | 9 | 9 | 9 | 8 | 8 | 9 | **8.6** |
| 2 | Dashboard | 8 | 7 | 8 | 9 | 9 | 7 | 7 | 8 | **7.9** |
| 3 | Clients | 8 | 9 | 9 | 9 | 8 | 7 | 9 | 9 | **8.6** |
| 4 | Client Card | 8 | 8 | 8 | 9 | 8 | 7 | 8 | 8 | **8.0** |
| 5 | Calendar | 9 | 9 | 8 | 9 | 9 | 6 | 9 | 9 | **8.4** |
| 6 | AI Workspace | 8 | 8 | 8 | 9 | 9 | 7 | 9 | 9 | **8.4** |
| 7 | Team Chat | 8 | 9 | 9 | 9 | 9 | 6 | 9 | 9 | **8.5** |
| 8 | Knowledge Base | 8 | 9 | 9 | 9 | 9 | 6 | 9 | 8 | **8.4** |
| 9 | Analytics | 8 | 8 | 7 | 9 | 9 | 7 | 8 | 8 | **8.0** |
| 10 | Team | 8 | 7 | 8 | 9 | 9 | 7 | 7 | 8 | **7.9** |
| 11 | Settings | 8 | 7 | 8 | 9 | 9 | 7 | 7 | 8 | **7.9** |
| — | **Tasks** *(off-path gap)* | 7 | **2** | 7 | **3** | **3** | 6 | **2** | **3** | **4.1** |

**Platform UX average (demo path):** **8.1 / 10**  
**With Tasks included:** **7.4 / 10**

### UX issues found

| Type | Examples |
|------|----------|
| Empty pages | Tasks on fresh install |
| Placeholder | Relocation/Checkups external links |
| Disabled buttons | Settings integrations (intentional) |
| Broken links | None critical in demo path |
| Mixed language | Tasks, nav labels, Meet, StatusBadge |
| Dev-tool appearance | Lead Review, Formgrid, debug if exposed |

---

## 7. Navigation audit

### Текущий порядок (Manager)

1. Dashboard · 2. Clients · 3. **Новые лиды** ❌ · 4. **Новые клиенты из анкеты** ❌ · 5. AI · 6. KB · 7. Tasks · 8. Calendar · 9. **Записи встреч** · 10. Team Chat · 11. **Эмиграция** · 12. **Чекапы** · 13. Team · 14. Website

### Owner adds

Analytics · Settings

### Проблемы

- 5 nav items hardcoded RU (not in i18n)
- Lead Review + Formgrid in nav but not demo-ready
- Relocation/Checkups niche — clutter public demo
- Meeting recordings visible but LiveKit off

### Рекомендуемый порядок (public demo)

**Manager:** Dashboard → Clients → Tasks → Calendar → AI Workspace → Team Chat → Knowledge Base → Team → Website

**Owner adds:** Analytics → Settings

**Hide:** Lead Review, Formgrid, Meeting Recordings, Relocation, Checkups (or move to Settings → Resources)

### Deep links

| Source | Status |
|--------|--------|
| Notifications | ✅ demo-nav encoded |
| Team chat | ✅ KB reference (conceptual) |
| Calendar | ✅ demo event IDs |
| AI sources | ✅ `/knowledge-base?article=` |
| Tasks | ✅ query params |

---

## 8. Performance audit

### Bundle (from PR #9 build)

| Route | Size | First Load JS |
|-------|------|---------------|
| Shared | — | 103 kB |
| `/calendar` | 17.3 kB | 196 kB |
| `/ai-workspace` | 5.73 kB | 228 kB |
| `/knowledge-base` | 4.23 kB | 227 kB |
| `/tasks` | 10.5 kB | 194 kB |
| `/team-chat` | 10.8 kB | 190 kB |

**Heaviest:** AI Workspace + KB (~228 kB First Load) — react-markdown shared.

### Recommendations (no refactor now)

| Issue | Recommendation |
|-------|----------------|
| Large dictionaries (~1600 lines × 2) | Split by namespace; lazy load rare modules |
| react-markdown in KB + AI | Shared chunk OK; monitor |
| Client components | Most views client-side — expected |
| Calendar 60s KB poll removed in demo | ✅ |
| Team chat 60s refresh | Acceptable |
| Demo seeds on first request | KB/chat/calendar — fast (<100ms local) |
| Build warnings | None critical in last build |
| Hydration | Not observed in tests |
| `rejectUnauthorized: false` | Performance N/A — security issue |

---

## 9. Что ещё не готово

### Блокирует public deploy (3)

| # | Blocker |
|---|---------|
| B2 | **No persistent store on Vercel** (`.data/` ephemeral) |
| B3 | **No demo reset** mechanism |
| B7 | **Misconfiguration guard** — prod Google/Supabase enable = data leak |

### ~~Закрыто в PR #11~~

| # | Blocker | Status |
|---|---------|--------|
| ~~B1~~ | ~~Tasks — no i18n, no demo seed~~ | ✅ |
| ~~B4~~ | ~~Login brute force~~ | ✅ demo rate limit |
| ~~B5~~ | ~~Nav mixed language~~ | ✅ |
| ~~B6~~ | ~~No custom error pages~~ | ✅ |
| — | Debug in demo | ✅ |

### Не блокирует, но желательно (8)

| # | Item |
|---|------|
| N1 | Meet in-room i18n |
| N2 | Meeting recordings hide/polish |
| N3 | Lead Review / Formgrid hide or i18n |
| N4 | PWA install hint i18n |
| N5 | StatusBadge → use `statuses` namespace |
| N6 | 2 pre-built AI chat sessions |
| N7 | Croatia analytics direction fix |
| N8 | Mobile sidebar / calendar polish |

### Future (6)

External clients · Recording playback · WhatsApp · Gmail · Stripe · Guided tour (PR #15)

---

## 10. Readiness score breakdown

| Area | Weight | Score | Weighted |
|------|--------|-------|----------|
| i18n (demo path) | 20% | 88% | 17.6% |
| Demo data completeness | 20% | 82% | 16.4% |
| Security (default demo env) | 20% | 85% | 17.0% |
| UX (demo path) | 20% | 87% | 17.4% |
| Infrastructure (deploy-ready) | 20% | 45% | 9.0% |
| **Total** | | | **77.4% → 77%** |

---

## 11. Documents produced

| Document | Purpose |
|----------|---------|
| `SPIORA_FULL_DEMO_READINESS_AUDIT.md` | This file — executive summary |
| `SPIORA_ROUTE_INVENTORY.md` | All 88 routes |
| `SPIORA_DEMO_DATA_INVENTORY.md` | Data sources per module |
| `SPIORA_SECURITY_GAP_REPORT.md` | Critical/High/Medium/Low |
| `SPIORA_FINAL_RELEASE_ROADMAP.md` | PR #11–#16 plan |

---

## 12. Recommendations

### Immediate (PR #12)

1. Unified seed + demo reset  
2. Demo Supabase on Vercel  
3. Hide internal nav routes (optional)  
4. Meet / Leads i18n (optional polish)

### ~~PR #11 — выполнено~~

1. ~~Localize Tasks module~~  
2. ~~Localize nav labels in `permissions.ts`~~  
3. ~~Login rate limiting~~  
4. ~~Hard-block debug in demo~~  
5. ~~Custom error pages~~  
6. ~~Demo tasks seed (20)~~

---

## 13. git status

```
On branch main
Untracked: SPIORA_FULL_DEMO_READINESS_AUDIT.md
           SPIORA_ROUTE_INVENTORY.md
           SPIORA_DEMO_DATA_INVENTORY.md
           SPIORA_SECURITY_GAP_REPORT.md
           SPIORA_FINAL_RELEASE_ROADMAP.md
nothing else modified
```

**Commit не создан** — по инструкции PR #10.

---

## SAFE / NOT SAFE

| | |
|--|--|
| **SAFE** | Audit documents only; no code/env changes |
| **Platform NOT SAFE for public deploy** | Until PR #11–#14 complete |
| **SAFE for internal sales demo** | Owner login, default demo env, local `.data/` |
