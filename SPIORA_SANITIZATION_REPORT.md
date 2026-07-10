# SPIORA Sanitization Report — PR #0

**Date:** 2026-07-10  
**PR:** #0 Demo Sanitization  
**Status:** ✅ Complete (pending commit)

---

## 1. Objective

Remove real PII, production identifiers, and original-company branding from the demo codebase so the project is safe for GitHub publication and client demonstrations.

**Temporary demo company name:** Northstar Mobility (Spiora rebrand planned in PR #2).

---

## 2. Summary

| Metric | Value |
|--------|-------|
| Files changed | **92** (+ 1 new `icon.svg`) |
| Files deleted | **23** (PII audits + legacy logos) |
| Lines removed (approx.) | **~1,700** |
| Lines added (approx.) | **~575** |
| `src/` PII scan (post-cleanup) | **0 matches** for gmail, sharp-spice, production IDs |
| `npm test` | **303/303 pass** |
| `npm run build` | **Success** |

---

## 3. What was removed or replaced

### 3.1 Real employees (critical)

| Before | After |
|--------|-------|
| Вероника, Злата, Юля, Руслан | Olivia Bennett, Daniel Cooper, Emma Wilson, Lucas Martin |
| `virineya1983@gmail.com` etc. | `olivia@spiora.demo`, `daniel@spiora.demo`, … |
| userId `veronika`, `manager-1` | `olivia-bennett`, `daniel-cooper`, … |
| Passwords in `DemoCredentials.tsx` | Removed from source — hint to use `AUTH_PASSWORD_*` in `.env.local` |
| `AUTH_PASSWORD_VERONIKA` | `AUTH_PASSWORD_OWNER` in `.env.example` |

**Files:** `src/lib/auth/users.ts`, `DemoCredentials.tsx`, `LoginForm.tsx`, `src/lib/team/permissions.ts`, calendar/notification tests, capture scripts.

### 3.2 Company / brand (partial — full rebrand in PR #2)

| Before | After |
|--------|-------|
| Sharp & Spice | Northstar Mobility (UI, manifest, login, AI prompts) |
| `sharp-spice` company ID | `northstar-mobility` |
| `sharp-spice-cal-*` rooms | `northstar-cal-*` |
| Production Netlify marketing URL | `https://example.com/northstar-mobility` |
| Legacy logo images (root + favicon) | Deleted; neutral `public/logo.svg`, `src/app/icon.svg` |

### 3.3 Demo CRM data

- `src/lib/google-sheets/demo-data.ts` — 12 fictional clients (`DEMO-1001`…), `@example.com`, `DEMO-P*` passports, demo managers.
- Removed references to «Вероника» and real-looking passport formats.

### 3.4 Production integrations (code)

| Area | Change |
|------|--------|
| `.env.example` | Fully cleaned template — no spreadsheet/folder IDs, no production URLs |
| `formgrid-leads.ts` | Removed hardcoded Formgrid spreadsheet ID; returns demo empty table without env |
| `relocation/forms.ts` | All external URLs → `example.com/demo/...` placeholders |
| `checkups/resources.ts` | Removed real Vercel/Gamma/Drive links |
| `.github/workflows/calendar-reminders-cron.yml` | Uses `vars.DEMO_APP_URL` instead of production Vercel URL |
| `KnowledgeBaseView.tsx` | Generic demo service account placeholder |

### 3.5 Documentation with real PII (deleted)

- `CRM_DEDUP_GAP_ANALYSIS.md`
- `FINAL_CRM_WRITE_CANDIDATES.md`
- `CRM_WRITE_DRY_RUN_SAFETY_AUDIT.md`
- `SERVICE_ACCOUNT_AUDIT.md`
- `TEST_LEAD_GUARD_REPORT.md`
- `FORMGRID_DATA_QUALITY_REPORT.md`
- `CLIENT_IDENTITY_AUDIT.md`
- `CLIENT_DATA_SOURCE_OF_TRUTH_REPORT.md`
- `CRM_NATIVE_SHEET_READINESS_REPORT.md`
- `CRM_WRITE_POST_GO_LIVE_AUDIT.md`
- `CRM_WRITE_PRODUCTION_READINESS.md`
- `CRM_CLIENT_CREATION_RULES.md`
- `CRM_GOOGLE_SHEETS_MIGRATION_PLAN.md`
- `CRM_XLSX_TO_GOOGLE_SHEET_SAFE_MIGRATION.md`
- `LEAD_REVIEW_CRM_WRITE_IMPLEMENTATION_PLAN.md`

### 3.6 Local runtime data (not in git)

- Deleted `.data/` folder on disk (contained `veronika.json`, formgrid leads with real emails/JWT samples).
- **Recommendation:** never commit `.data/`; regenerate locally or use demo Supabase in PR #1+.

### 3.7 Assets removed

- `logo 11.png`, `logo_15.jpg`, `main_logo.jpg`, `new_logo2.jpg`, `logo13.svg`
- `public/favicon.jpg`, `public/logo.png`
- `src/app/icon.jpg`, `src/app/apple-icon.jpg`

---

## 4. Automated scan results (post-cleanup)

Scanned: `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, `.md`, `.yml`, `.yaml`, `.sql`, `.env.example`, `public/`.

### 4.1 Clean areas

- **`src/`** — no matches for: `@gmail.com`, `virineya`, `sharp-spice`, production spreadsheet IDs, production Vercel URLs.
- **`.env.example`** — template only.

### 4.2 Remaining findings (intentional or deferred)

| Category | Count | Notes |
|----------|-------|-------|
| Original brand in internal design `*.md` | ~15 files | Architecture/calendar docs; historical text only, no PII. Sanitize in PR #2 or delete archive docs. |
| `SPIORA_*` audit docs | 3 files | Describe **pre-sanitization** state for traceability; update when committing PR #0. |
| PWA PNG icons in `public/icons/` | 4 files | Legacy raster icons may still show old colors; replace in PR #2 branding. |
| `.env.local` on disk | **Not scanned / not changed** | May still contain production credentials — **never commit**. |

---

## 5. What was intentionally NOT changed

| Item | Reason |
|------|--------|
| `.env.local` | Per instruction — local only, gitignored |
| Full Spiora rebrand | Deferred to **PR #2** |
| i18n / English default | Deferred to **PR #3** |
| `SPIORA_DEMO_MODE` guards | Deferred to **PR #1** |
| Supabase demo project | Deferred to **PR #1 / #5** |
| UI copy still in Russian | Sanitization only — translation in PR #3+ |

---

## 6. SAFE / NOT SAFE TO COMMIT

### ✅ SAFE TO COMMIT (this PR)

- All modified/deleted source files listed in `git diff --stat`
- `.env.example` (clean template)
- `public/logo.svg`, `src/app/icon.svg`
- `SPIORA_SANITIZATION_REPORT.md`
- Deleted PII audit markdown files

### ❌ NOT SAFE TO COMMIT

| File | Reason |
|------|--------|
| `.env.local` | May contain production Supabase, Google, OpenRouter, LiveKit keys |
| `.env.development.local` | Local overrides |
| `.data/` | Runtime JSON with user-specific data |
| Any future file with real credentials | — |

### ⚠️ Before public GitHub push

1. Confirm `git status` does not stage `.env.local`
2. Run secret scan on staged files
3. Complete **PR #1** (ENV isolation + demo guards)
4. Replace or remove remaining internal `*.md` with «Sharp & Spice» if publishing full repo history

---

## 7. Verification

```text
npm test   → 303 pass, 0 fail
npm run build → Success (Next.js 15.5.18)
git remote → none (Stage 1 complete)
```

---

## 8. Updated PR roadmap (accepted)

| PR | Title |
|----|-------|
| **#0** | Demo Sanitization ← **this report** |
| **#1** | Git + ENV Isolation |
| **#2** | Spiora Branding |
| **#3** | English/Russian Localization |
| **#4** | Demo Users + Demo Company |
| **#5** | Demo CRM + Calendar + Tasks + AI |
| **#6** | Demo Security |
| **#7** | Guided Demo |

---

## 9. Recommended next step

Create commit for PR #0 (when approved):

```text
Sanitize demo copy: remove PII and production identifiers
```

Then proceed to **PR #1 — Git + ENV Isolation** (`SPIORA_DEMO_MODE`, production URL guards, clean local `.env.local` workflow).
