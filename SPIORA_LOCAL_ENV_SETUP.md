# Spiora — настройка локального demo-окружения

Этот документ описывает, как безопасно запустить Spiora demo **без подключения к production** оригинальной платформы.

## Быстрый старт

1. Скопируйте шаблон:
   ```bash
   cp .env.spiora.example .env.local
   ```
2. Сгенерируйте секреты:
   ```bash
   openssl rand -base64 32
   ```
   Заполните `AUTH_SECRET` и `CRON_SECRET`.
3. Задайте пароли demo-команды (`AUTH_PASSWORD_*`) — см. `src/lib/auth/users.ts`.
4. Убедитесь, что **`SPIORA_DEMO_MODE=true`**.
5. Запустите:
   ```bash
   npm run dev
   ```

> **Важно:** не копируйте значения из старого `.env.local` production-копии. Если файл уже существует — создайте новый по шаблону или очистите production-переменные вручную.

---

## Обязательные переменные

| Переменная | Назначение |
|---|---|
| `SPIORA_DEMO_MODE` | Должна быть `true` — включает изоляцию demo |
| `AUTH_SECRET` | Сессии и JWT |
| `CRON_SECRET` | Защита cron endpoint |
| `AUTH_PASSWORD_*` | Пароли demo-пользователей |
| `NEXT_PUBLIC_APP_URL` | Обычно `http://localhost:3000` |

---

## Интеграции: что отключено по умолчанию

При `SPIORA_DEMO_MODE=true` все внешние интеграции **выключены**, пока не задан соответствующий `SPIORA_ENABLE_*=true`:

| Интеграция | Флаг включения | Поведение без флага |
|---|---|---|
| Supabase | `SPIORA_ENABLE_SUPABASE` | File-based fallback (задачи, чат, календарь) |
| Google Sheets / Drive | `SPIORA_ENABLE_GOOGLE_INTEGRATIONS` | Встроенные demo-клиенты (`demo-data.ts`) |
| OpenRouter / OpenAI | `SPIORA_ENABLE_EXTERNAL_AI` | Canned AI-ответы, без HTTP-запросов |
| LiveKit | `SPIORA_ENABLE_LIVEKIT` | Видеовстречи недоступны |
| Emigrant Desk | `SPIORA_ENABLE_EMIGRANT_DESK` | Desk API отключён |
| Cron reminders | `SPIORA_ENABLE_CRON` | `/api/cron/calendar-reminders` → 503 |
| Webhooks (LiveKit egress) | `SPIORA_ENABLE_WEBHOOKS` | `/api/webhooks/livekit` → 503 |

Email-рассылки в demo не используются — напоминания календаря работают только in-app при наличии Supabase.

---

## Как создать чистый `.env.local`

1. Переименуйте старый файл (не удаляйте, если нужен для справки):
   ```bash
   mv .env.local .env.local.backup
   ```
2. Скопируйте `.env.spiora.example` → `.env.local`.
3. Заполните только demo-значения из раздела «Обязательные переменные».
4. **Не заполняйте** Supabase, Google, LiveKit, OpenRouter — пока нет отдельных demo-проектов.

---

## Запрещённые значения

Не используйте в `.env.local` для Spiora demo:

- URL деплоя оригинальной платформы (`sharp-spice-team-platform`, `emigrant-croatia-desk` и т.п.)
- Production Supabase project ref (добавьте в `SPIORA_BLOCKED_SUPABASE_PROJECT_REFS`)
- Production Google Spreadsheet / Drive folder ID (добавьте в `SPIORA_BLOCKED_*`)
- Production API-ключи OpenRouter, LiveKit, Google service account

При включении Supabase в demo (`SPIORA_ENABLE_SUPABASE=true`) **обязателен** whitelist:

```
SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=only-your-demo-ref
```

Любой другой ref будет отклонён guard при старте.

---

## Проверка изоляции

### 1. Environment guard при старте

При `SPIORA_DEMO_MODE=true` модуль `src/lib/demo/environment-guard.ts` проверяет конфигурацию через `src/instrumentation.ts`. При нарушении приложение **не запустится** с понятной ошибкой.

### 2. Unit-тесты

```bash
npm test
```

Файл `src/lib/demo/environment-guard.test.ts` проверяет:
- отклонение production URL;
- отклонение blocked Supabase ref и Spreadsheet ID;
- accept demo allowlist;
- отключение интеграций без `SPIORA_ENABLE_*`.

### 3. Ручная проверка

После запуска с чистым `.env.local`:

- CRM показывает клиентов `DEMO-1001` … из `demo-data.ts`
- AI workspace отвечает canned-режимом (поле `demo: true` в ответе API)
- `/api/cron/calendar-reminders` возвращает 503
- `/api/webhooks/livekit` возвращает 503

---

## Blocklist (локально, не коммитить)

Добавьте в `.env.local` production ref/ID из старого окружения:

```env
SPIORA_BLOCKED_SUPABASE_PROJECT_REFS=old-prod-ref
SPIORA_BLOCKED_GOOGLE_SPREADSHEET_IDS=old-spreadsheet-id
SPIORA_BLOCKED_GOOGLE_DRIVE_FOLDER_IDS=old-folder-id
```

Тогда guard остановит запуск, если эти значения случайно попадут в env.

---

## Когда появится demo Supabase

1. Создайте отдельный Supabase project для Spiora demo.
2. В `.env.local`:
   ```env
   SPIORA_ENABLE_SUPABASE=true
   SPIORA_ALLOWED_SUPABASE_PROJECT_REFS=your-demo-ref
   NEXT_PUBLIC_SUPABASE_URL=https://your-demo-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
3. Перезапустите приложение — guard проверит allowlist.

---

## Связанные файлы

- `.env.example` — полный список переменных
- `.env.spiora.example` — минимальный безопасный шаблон
- `src/lib/demo/environment-guard.ts` — проверки при старте
- `src/lib/demo/integration-policy.ts` — политика включения интеграций
- `SPIORA_ENV_ISOLATION_REPORT.md` — отчёт по PR #1
