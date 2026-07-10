# Spiora — отчёт PR #1: Git + ENV Isolation

**Дата:** 10 июля 2026  
**Статус:** реализация завершена, commit **не выполнен** (ожидает подтверждения)

---

## Цель

Технически исключить случайное подключение demo-копии Spiora к production-инфраструктуре оригинальной платформы.

---

## Новые файлы

| Файл | Назначение |
|---|---|
| `src/lib/demo/demo-mode.ts` | Флаг `SPIORA_DEMO_MODE`, парсинг CSV env |
| `src/lib/demo/integration-policy.ts` | Политика включения интеграций (`SPIORA_ENABLE_*`) |
| `src/lib/demo/environment-guard.ts` | Проверки URL, Supabase ref, Google ID, секретов |
| `src/lib/demo/environment-guard.test.ts` | Unit-тесты guard + integration policy |
| `src/instrumentation.ts` | Запуск guard при старте Next.js (Node runtime) |
| `.env.spiora.example` | Безопасный минимальный шаблон demo-окружения |
| `SPIORA_LOCAL_ENV_SETUP.md` | Инструкция по настройке `.env.local` |

---

## Изменённые файлы

| Файл | Изменение |
|---|---|
| `.env.example` | Переписан под Spiora + `SPIORA_DEMO_MODE` и blocklist/enable флаги |
| `package.json` | Добавлен `environment-guard.test.ts` в `npm test` |
| `src/lib/supabase/config.ts` | Supabase отключён в demo без `SPIORA_ENABLE_SUPABASE` |
| `src/lib/google-sheets/auth.ts` | Google Sheets/Drive отключены; token не запрашивается |
| `src/lib/ai/config.ts` | `isAiConfigured()` учитывает demo policy |
| `src/lib/ai/openai.ts` | Блокировка HTTP к OpenRouter/OpenAI без enable-флага |
| `src/lib/emigrant-desk/config.ts` | Emigrant Desk отключён в demo |
| `src/lib/calendar/meeting-token.ts` | LiveKit отключён в demo |
| `src/app/api/cron/calendar-reminders/route.ts` | Cron → 503 в demo |
| `src/app/api/webhooks/livekit/route.ts` | Webhooks → 503 в demo |

---

## Diff summary

```
10 изменённых файлов: +116 / −28 строк
+ 7 новых файлов (demo-модули, instrumentation, docs, .env.spiora.example)
```

---

## Архитектура изоляции

```
SPIORA_DEMO_MODE=true
        │
        ▼
instrumentation.ts ──► environment-guard.ts
        │                    │
        │                    ├─ blocked URL substrings
        │                    ├─ blocked Supabase refs / Google IDs
        │                    └─ allowlist при SPIORA_ENABLE_SUPABASE
        ▼
integration-policy.ts ──► isSupabaseConfigured()
                        ├─ areGoogleIntegrationsEnabled()
                        ├─ isExternalAiIntegrationEnabled()
                        ├─ isLiveKitIntegrationEnabled()
                        ├─ isCronIntegrationEnabled()
                        └─ areWebhooksIntegrationEnabled()
```

**Принцип:** при `SPIORA_DEMO_MODE=true` все внешние интеграции **выключены по умолчанию**. Production credentials в `.env.local` **игнорируются** runtime, пока не включён соответствующий `SPIORA_ENABLE_*` флаг. При включении — guard требует allowlist / проверяет blocklist.

---

## Отключённые интеграции (demo по умолчанию)

| Интеграция | Статус | Fallback |
|---|---|---|
| Supabase | Disabled | File-based storage |
| Google Sheets | Disabled | `demo-data.ts` (12 demo-клиентов) |
| Google Drive (KB, Emigrant) | Disabled | Пустой KB / stub |
| OpenRouter / OpenAI | Disabled | Canned AI (`buildDemoReply`) |
| LiveKit | Disabled | Видеовстречи недоступны |
| Emigrant Desk | Disabled | API не активен |
| Cron (`/api/cron/calendar-reminders`) | Disabled | HTTP 503 |
| Webhooks (`/api/webhooks/livekit`) | Disabled | HTTP 503 |
| Email | N/A | Не используется в demo |

---

## Проверки environment guard

При `SPIORA_DEMO_MODE=true` проверяются:

- Supabase URL и project ref
- Google Spreadsheet ID и Drive Folder ID
- OpenRouter key (при `SPIORA_ENABLE_EXTERNAL_AI`)
- LiveKit URL (при `SPIORA_ENABLE_LIVEKIT`)
- Webhook URLs (`SPIORA_WEBHOOK_URL`, `LIVEKIT_WEBHOOK_URL`)
- Cron target URL (`SPIORA_CRON_TARGET_URL`)
- URL-подстроки production-деплоев (`sharp-spice-team-platform`, `emigrant-croatia-desk`)

При нарушении — **остановка запуска** с понятным сообщением на русском.

---

## Результаты тестов

```
npm test
ℹ tests 314
ℹ pass 314
ℹ fail 0
```

Новые тесты (`environment-guard.test.ts`):
- production URL отклоняется
- demo URL принимается
- blocked Supabase ref отклоняется
- blocked Spreadsheet ID отклоняется
- allowlist Supabase обязателен при enable
- demo ref в allowlist принимается
- без `SPIORA_DEMO_MODE` guard не активен
- production credentials не активируют интеграции без `SPIORA_ENABLE_*`

---

## Результаты сборки

```
npm run build
✓ Compiled successfully
✓ Generating static pages (55/55)
Exit code: 0
```

> Сборка использует существующий `.env.local` (не изменён). Если в нём нет `SPIORA_DEMO_MODE=true`, guard при сборке не блокирует. **Для изоляции добавьте `SPIORA_DEMO_MODE=true` по инструкции `SPIORA_LOCAL_ENV_SETUP.md`.**

---

## Git status

```
Branch: main (без remote)
Modified: 10 files
Untracked: .env.spiora.example, SPIORA_LOCAL_ENV_SETUP.md, src/instrumentation.ts, src/lib/demo/
Commit: не выполнен
```

---

## SAFE / NOT SAFE TO COMMIT

### ✅ SAFE TO COMMIT (после вашего подтверждения)

- `src/lib/demo/**`
- `src/instrumentation.ts`
- `.env.example`
- `.env.spiora.example`
- `SPIORA_LOCAL_ENV_SETUP.md`
- `SPIORA_ENV_ISOLATION_REPORT.md`
- Изменения в `package.json` и integration config/routes

### ⛔ NOT SAFE TO COMMIT

- `.env.local` — содержит production credentials (не изменялся, не в staging)
- Любые файлы с реальными API-ключами, Supabase ref, Google ID

---

## Рекомендуемый commit message (когда подтвердите)

```
Add Spiora demo environment isolation guard and integration policy

Prevent accidental production connections via SPIORA_DEMO_MODE,
startup validation, and opt-in SPIORA_ENABLE_* flags for external services.
```

---

## Следующие шаги

1. Подтвердить commit PR #1
2. Создать чистый `.env.local` по `.env.spiora.example`
3. PR #2 — Branding
