# SPIORA i18n Architecture — Phase A

**Date:** 2026-07-10  
**Project:** Next.js **15.3.3**, App Router, React 19  
**Current default language:** Russian (`<html lang="ru">` in `src/app/layout.tsx`)

---

## 1. Current state audit

### 1.1 No localization framework

- No `next-intl`, `react-i18next`, or custom dictionary layer
- No `[locale]` route segment
- No locale cookie or header detection
- Dates formatted with hardcoded `"ru-RU"` in ~15+ components/libs
- Navigation mix: English labels (`Dashboard`, `AI Workspace`, `Team`) + Russian (`Клиенты`, `Задачи`, `Календарь`, …)

### 1.2 Cyrillic inventory (automated scan)

| Area | Files with Cyrillic | Approx. Cyrillic token matches* |
|------|---------------------|----------------------------------|
| `src/components/**` | ~75 | ~2,280 |
| `src/app/**` | ~25 | ~134 |
| `src/lib/ai/**` | ~35 | ~2,943 |
| Other `src/lib/**` | ~94 | ~1,655 |
| **Total** | **229** | **~7,012** |

\*Token = contiguous Cyrillic substring ≥3 chars (includes repeated words, comments, demo data, AI prompts).

### 1.3 Top UI modules by Cyrillic volume

| Module | Matches | Priority for i18n |
|--------|---------|-------------------|
| `meet/` (video) | ~435 | P1 |
| `tasks/` | ~372 | P1 |
| `calendar/` | ~290 | P1 |
| `analytics/` | ~220 | P2 |
| `team-chat/` | ~184 | P1 |
| `clients/` | ~162 | P1 |
| `ai-workspace/` | ~151 | P1 |
| `settings/` | ~96 | P2 |
| `dashboard/` | ~59 | P1 |
| `notifications/` | ~48 | P1 |
| `leads/` | ~44 | P2 (may hide in demo) |
| `knowledge-base/` | ~16 | P2 |

### 1.4 Hardcoded Russian outside UI components

User-facing strings also live in:

- `src/lib/auth/permissions.ts` — nav labels  
- `src/lib/notifications/labels.ts`, `constants.ts`, `calendar-reminder-copy.ts`  
- `src/lib/tasks/permissions.ts`, `workflow.ts`, `types.ts`  
- `src/lib/calendar/form.ts`, `constants.ts`, `datetime-input.ts`  
- `src/lib/leads/lead-review-action-errors.ts`  
- API error messages in `src/app/api/**`  
- AI system prompts in `src/lib/ai/workspace-prompt.ts`, `client-assistant.ts`, etc.

**Estimate of unique user-facing UI keys:** **700–950** (after deduplication)  
**Additional server/API message keys:** **150–250**  
**AI prompt / response templates (bilingual, not standard UI keys):** **200–400** separate entries

Total dictionary entries (EN + RU): plan for **~1,200–1,500 keys** in JSON dictionaries, plus AI prompt variants.

---

## 2. Requirements mapping

| Requirement | Approach |
|-------------|----------|
| Default locale `en` | Set `defaultLocale: 'en'` in config; change `<html lang>` dynamically |
| Secondary `ru` | Full `ru.json` dictionary |
| Persist locale across reload | Cookie `SPIORA_LOCALE` (httpOnly optional) + `localStorage` fallback for client-only islands |
| Switch without losing page | Cookie-based locale **without URL prefix** (see §3) |
| No inline `locale === "ru" ? ...` | `t('key')` / `useTranslations()` only |
| Fallback English | Missing key → English string + dev-only console warn |
| Format dates/numbers | `Intl.DateTimeFormat(locale)` wrapper in `src/i18n/format.ts` |
| Login page switcher | Client component beside `LoginForm` |
| Desktop header / mobile menu | `LanguageSwitcher` in `TopbarClient` + mobile nav |

---

## 3. Recommended library: **next-intl**

### Why next-intl (over react-i18next or fully custom)

| Criterion | next-intl | Custom context | react-i18next |
|-----------|-----------|----------------|---------------|
| Next.js 15 App Router | ✅ First-class RSC support | ⚠️ Manual SSR wiring | ⚠️ heavier client bundle |
| Server Components | ✅ `getTranslations()` | Possible | Mostly client |
| Type-safe keys | ✅ With codegen optional | Manual | Plugins |
| Cookie persistence | ✅ Documented pattern | DIY | DIY |
| Maintenance | Active, common in Next ecosystem | Low dep, high effort | Generic React |

**Decision:** Use **`next-intl` v4.x** with a **single locale-agnostic URL tree** for Phase 1 of i18n (minimize route churn).

### Alternative considered: URL prefix `/en/...`, `/ru/...`

- **Pros:** SEO, shareable localized links  
- **Cons:** Requires moving entire `src/app` under `[locale]`, updating all `Link`/`redirect`, middleware rewrite — high regression risk for a demo fork  

**Recommendation:** Start **without URL prefix**. Add prefix later if Spiora becomes a public marketing site.

---

## 4. Proposed structure

```text
src/
  i18n/
    config.ts              # locales, defaultLocale, cookie name
    request.ts             # next-intl server request config
    get-dictionary.ts      # load JSON by locale (if not using next-intl built-in)
    format.ts              # formatDate, formatNumber, formatRelative
    dictionaries/
      en.json
      ru.json
    namespaces/            # optional split by PR #3/#4
      common.json
      nav.json
      auth.json
      dashboard.json
      crm.json
      tasks.json
      calendar.json
      chat.json
      ai.json
      analytics.json
      errors.json
  config/
    branding.ts            # productName, defaultLocale, availableLocales (Stage 3)
  components/
    i18n/
      LanguageSwitcher.tsx
      I18nProvider.tsx     # thin wrapper if needed for client subtrees
```

### 4.1 `config.ts` (illustrative)

```ts
export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "SPIORA_LOCALE";
```

### 4.2 Middleware integration

Extend `middleware.ts`:

1. Read `SPIORA_LOCALE` cookie (validate `en` | `ru`)  
2. Pass locale to next-intl middleware helper **or** set request header `x-spiora-locale`  
3. Keep existing auth middleware logic unchanged  

### 4.3 Provider wiring

- `src/app/layout.tsx` → wrap with `NextIntlClientProvider` for client children  
- Server pages → `getTranslations('namespace')`  
- Shared nav in `permissions.ts` → move labels to `nav` namespace; build nav at runtime with `t()`

### 4.4 Language switcher UX

```
[ EN | RU ]
```

- Toggle sets cookie + `router.refresh()`  
- Active locale visually highlighted  
- `aria-label` localized  

Placement:

| Surface | Location |
|---------|----------|
| Login | Right of form / above submit |
| Desktop | `TopbarClient` next to notifications |
| Mobile | Same topbar menu or profile/settings sheet |

---

## 5. Translation key conventions

```text
{namespace}.{section}.{element}
```

Examples:

```json
{
  "nav.clients": "Clients",
  "tasks.status.in_progress": "In progress",
  "calendar.empty.title": "No events yet",
  "errors.unauthorized": "You don't have access to this page.",
  "demo.badge": "Demo Environment"
}
```

Rules:

- **Do not translate:** demo person names, `@example.com` emails, `DEMO-*` IDs  
- **Do translate:** status enums shown in UI, role labels, empty states  
- **Params:** `"tasks.overdue": "{count, plural, one {# overdue task} other {# overdue tasks}}"` — use ICU via next-intl  

---

## 6. AI module special case

`src/lib/ai/**` contains ~2,900 Cyrillic tokens — mostly **LLM system prompts and parsing heuristics** for Russian client names.

| Content type | i18n strategy |
|--------------|---------------|
| UI in `AiWorkspaceView` | Standard `ai` namespace |
| System prompts | `src/lib/ai/prompts/en.ts` + `ru.ts` — select by user locale |
| Client search / morphology | Keep Russian NLP helpers; add English paths where needed |
| Canned demo responses (demo mode) | Bilingual static templates in `src/lib/demo/ai-responses.ts` |

Do **not** put megabyte-scale prompts in JSON dictionaries — use TypeScript modules per locale.

---

## 7. Date/time/number formatting

Centralize in `src/i18n/format.ts`:

```ts
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
```

Replace all hardcoded `"ru-RU"` call sites incrementally (PR #3–#4).

Calendar timezone: keep business TZ constant (`Europe/Zagreb` or configurable `SPIORA_DEMO_TIMEZONE`) — independent of display locale.

---

## 8. Migration strategy (by PR)

| PR | i18n work |
|----|-----------|
| #2 | Install next-intl, config, cookie, switcher, `common` + `nav` + `auth`, base tests |
| #3 | Dashboard, layout, notifications, errors, settings |
| #4 | CRM, tasks, calendar, chat, KB, analytics, team, AI UI |
| #5 | Demo data stays language-neutral; seed status labels may need `en`/`ru` display maps |
| #7 | Welcome, tour, tips, CTA strings |

### Incremental safety

1. Add English dictionary first; default locale `en` — app may look mixed until PR #4 completes  
2. Russian dictionary mirrors English keys — CI test fails on missing `ru` keys optional (warn only)  
3. Feature flag `SPIORA_I18N_ENABLED` optional during migration (default true once PR #2 merges)

---

## 9. Testing plan (PR #2 + #10)

| Test | Assertion |
|------|-----------|
| Default locale | No cookie → renders English |
| Switch to RU | Cookie set → Russian nav label |
| Persistence | Reload keeps RU |
| Fallback | Missing `ru` key → English |
| `formatDateTime('en')` | Uses en-GB/en-US pattern |
| Notifications | Translated title from `labels` namespace |

Suggested files:

- `src/i18n/config.test.ts`  
- `src/i18n/format.test.ts`  
- `src/components/i18n/LanguageSwitcher.test.tsx` (optional DOM-less cookie test)

---

## 10. Modules with hardcoded Russian (reference list)

**Layout / auth:** `Sidebar.tsx`, `TopbarClient.tsx`, `LoginForm.tsx`, `DemoCredentials.tsx`, `permissions.ts`

**Core product:** `DashboardView.tsx`, `ClientsList.tsx`, `ClientDetailView.tsx`, `TasksView.tsx`, `CalendarView.tsx`, `TeamChatView.tsx`, `AiWorkspaceView.tsx`, `KnowledgeBaseView.tsx`, `AnalyticsView.tsx`, `TeamView.tsx`, `SettingsView.tsx`

**Meetings:** all `src/components/meet/*`, `MeetingRecordingsView.tsx`

**Leads / relocation (demo may hide):** `LeadReview*`, `RelocationView.tsx`, `CheckupsView.tsx`, `CroatiaAnalyticsView.tsx`

**Libs (user-visible errors):** `team/store.ts`, `tasks/permissions.ts`, `calendar/form.ts`, `leads/lead-review-action-errors.ts`

---

## 11. Effort estimate (i18n only)

| Phase | Duration (1 dev) |
|-------|------------------|
| Foundation (PR #2) | 3–4 days |
| Core UI (PR #3) | 4–5 days |
| Modules (PR #4) | 6–8 days |
| AI prompts bilingual | 2–3 days |
| Tests + polish | 2 days |
| **Total** | **~17–22 dev-days** |

Parallel with branding/demo work after PR #2 lands.
