# SPIORA Google Dependency Report

**Дата:** 15 июля 2026  
**Цель:** полная инвентаризация зависимостей от Google Sheets и Google Drive.

---

## 1. Управление интеграцией

| Параметр | Файл / переменная |
|----------|-------------------|
| Master flag | `SPIORA_ENABLE_GOOGLE_INTEGRATIONS` |
| Demo default | **false** (`src/lib/demo/integration-policy.ts`) |
| Non-demo default | **true** если заданы SA credentials |
| Guard | `assertGoogleIntegrationAllowed()` в API routes |
| UI status | Settings → Integrations (статус «connected/disabled») |

**Hardcoded Spreadsheet/Folder ID в `src/`:** **не обнаружено** — только env.

---

## 2. Google Sheets — все использования

### 2.1 CRM Clients (критично для prod CRM)

| Аспект | Детали |
|--------|--------|
| **Файлы** | `src/lib/google-sheets/service.ts`, `client.ts`, `cache.ts`, `types.ts` |
| **API routes** | `/api/crm/clients`, `/api/crm/clients/[id]`, notes routes |
| **Env** | `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_CRM_RANGE`, SA email/key |
| **Чтение** | Все строки CRM: имя, контакты, статус, менеджер, метаданные |
| **Запись** | Append нового клиента (Lead Review sync); notes write path опционален |
| **Demo** | `DEMO_CLIENTS` из `demo-data.ts` |
| **Критичность** | **Critical** для prod без Postgres clients |
| **Можно отключить?** | Да в demo; **нет** для prod CRM без замены |
| **UI упоминания Google** | Settings integrations; **не** в CRM UI labels |
| **Primary CRM?** | **Да**, при `[G]=true` |

### 2.2 Formgrid Lead Intake

| Аспект | Детали |
|--------|--------|
| **Файлы** | `src/lib/formgrid/*`, `src/app/api/formgrid/*` |
| **Env** | `GOOGLE_SHEETS_FORMGRID_SPREADSHEET_ID`, public CSV URL |
| **Чтение** | CSV export Formgrid → leads |
| **Запись** | Нет в Sheets; state в app_state / `.data` |
| **Demo** | Пустая очередь |
| **Критичность** | **High** для lead pipeline |
| **UI** | Lead Review module |

### 2.3 Lead Review → CRM Write

| Аспект | Детали |
|--------|--------|
| **Файлы** | `src/lib/lead-review/*`, `/api/lead-review/*` |
| **Flow** | Approve lead → append CRM row in Sheets |
| **Demo** | Local state only |
| **Критичность** | **High** при Google CRM |

### 2.4 CRM Field Update (legacy)

| Аспект | Детали |
|--------|--------|
| **Файл** | `updateClientField()` в service.ts |
| **Статус** | **Dead code** — API routes не вызывают |
| **Критичность** | Low |

### 2.5 AI Diagnostic (Sheets inspection)

| Аспект | Детали |
|--------|--------|
| **Route** | `/api/ai/diagnostic` (или аналог) |
| **Demo** | **404** через `workspace-demo-safe.ts` |
| **Чтение** | CRM rows для диагностики |
| **Критичность** | Medium (debug); скрыт в demo |

### 2.6 Analytics — Croatia supplement

| Аспект | Детали |
|--------|--------|
| **Файлы** | `src/lib/analytics/*` |
| **Зависимость** | Indirect — KPI from CRM client list |
| **Persistence** | `analytics-croatia-supplement.json` / app_state |
| **Критичность** | Medium |

---

## 3. Google Drive — все использования

### 3.1 Knowledge Base

| Аспект | Детали |
|--------|--------|
| **Файлы** | `src/lib/google-drive/kb-drive.ts`, `kb-text.ts`, `drive-content.ts` |
| **Env** | `GOOGLE_DRIVE_KB_FOLDER_ID` |
| **Scope** | Readonly (`drive.readonly` или metadata) |
| **Чтение** | Список файлов, содержимое документов для UI и AI |
| **Запись** | **Нет** |
| **Demo** | `.data/knowledge-base.json` + `demo-articles.ts` |
| **UI** | KB module; Google **не** показывается пользователю |
| **Критичность** | **High** для prod KB без Postgres |

### 3.2 Emigrant Desk documents (optional)

| Аспект | Детали |
|--------|--------|
| **Env** | `GOOGLE_DRIVE_EMIGRANT_FOLDER_ID` |
| **Статус** | Optional; модуль off by default |
| **Критичность** | Low (isolated feature) |

### 3.3 AI Workspace context

| Аспект | Детали |
|--------|--------|
| **Файлы** | `workspace-assistant.ts`, context builders |
| **Чтение** | KB excerpts + CRM from Sheets |
| **Передача в LLM** | Sanitized text blocks |
| **Критичность** | **High** (third-party data processing) |

---

## 4. Service Account и credentials

| Переменная | Назначение |
|------------|------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | SA identity |
| `GOOGLE_PRIVATE_KEY` | JWT signing for API |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | CRM workbook |
| `GOOGLE_SHEETS_FORMGRID_SPREADSHEET_ID` | Formgrid source |

**Где хранятся:** server env only (Vercel secrets). **Не** в client bundle.

**Scopes (типично):**
- `https://www.googleapis.com/auth/spreadsheets` — read/write CRM
- Drive readonly — KB listing/content

**Риски:**
- SA key rotation не автоматизирован
- Write scope на production spreadsheet
- Shared spreadsheet = shared trust boundary с Google Workspace admins

---

## 5. Import / Export

| Операция | Механизм |
|----------|----------|
| Import leads | Formgrid CSV → app (не Sheets write back) |
| Export CRM | Нет dedicated export API; данные уже в Sheets |
| KB import | Manual upload to Drive folder (ops process) |

---

## 6. Видимость Google для пользователя

| Место | Видит пользователь? |
|-------|---------------------|
| CRM UI | **Нет** — «Clients», не «Google Sheets» |
| Knowledge Base | **Нет** — статьи как native content |
| Settings → Integrations | **Да** — статус Google connection |
| Error messages | Редко — generic «integration unavailable» |
| AI Workspace | **Нет** |
| Lead Review | **Нет** прямого упоминания |

**Вывод:** Google — **скрытый backend** для prod; пользователь воспринимает Spiora как единую платформу.

---

## 7. Может ли Google оставаться primary CRM?

**Да, фактически так и есть сегодня** при:
- `SPIORA_DEMO_MODE=false`
- `SPIORA_ENABLE_GOOGLE_INTEGRATIONS=true`
- настроенных SA + Spreadsheet ID

PostgreSQL **не содержит** таблицы `clients`. Supabase не заменяет CRM при включении.

---

## 8. Данные, передаваемые в Google

| Данные | Направление | Компонент |
|--------|-------------|-----------|
| Client PII | → Sheets | CRM append/read |
| Lead form fields | ← CSV (Formgrid) | Lead intake |
| KB document text | ← Drive | KB + AI |
| Manager assignments | ↔ Sheets | CRM columns |
| Notes (optional path) | → Sheets | Client notes (legacy Google path) |

---

## 9. Риски доступа, утечки, целостности

| Риск | Уровень | Описание |
|------|---------|----------|
| SA key compromise | **Critical** | Full spreadsheet read/write |
| Spreadsheet shared publicly | **High** | Misconfiguration in Google Workspace |
| Column schema change | **High** | Manual sheet edits break parsers |
| Accidental row delete | **High** | No app-level audit trail in Sheets |
| Formgrid public CSV | **High** | Unauthenticated read of leads |
| AI sends CRM to LLM | **High** | Third-party processing |
| Drive folder mis-ACL | **Medium** | Over-shared KB folder |
| Cache stale data | **Medium** | TTL cache in `google-sheets/cache.ts` |

---

## 10. Ответ на главный вопрос

### Может ли Spiora полноценно работать без Google Sheets и Google Drive?

| Режим | Ответ |
|-------|-------|
| **Default demo** (`DEMO=true`, `GOOGLE=false`, `SUPABASE=false`) | **Да** — demo-data, `.data`, canned AI |
| **Demo + Supabase** | **Да** — operational modules in Postgres; CRM still demo static |
| **Production-style** (`DEMO=false`, `GOOGLE=true`) | **Нет** — CRM, Formgrid, KB зависят от Google |
| **Target corp prod** (Postgres CRM + Storage KB) | **Да** — после миграции (ещё не реализовано) |

---

## 11. Что можно отключить без потери основного функционала (demo)

| Интеграция | Отключение |
|------------|------------|
| Google Sheets CRM | ✅ → demo clients |
| Formgrid | ✅ → empty lead queue |
| Google Drive KB | ✅ → demo articles |
| AI OpenRouter | ✅ → canned responses |

---

## 12. Рекомендации (без реализации)

1. **Sheets → import/export only** после миграции clients в Postgres.
2. **Drive → optional sync** для legacy KB; primary KB in Supabase Storage + `kb_articles` table.
3. **Убрать public CSV** Formgrid → authenticated webhook или Postgres ingest.
4. **Rotate SA keys** + minimum scopes (separate read-only SA for analytics).
5. **Schema contract** для Sheets если sync остаётся (validation + version column).

---

*Отчёт подготовлен без изменений кода и конфигурации.*
