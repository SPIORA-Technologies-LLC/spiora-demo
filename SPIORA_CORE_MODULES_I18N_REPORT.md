# SPIORA Core Modules I18n — отчёт PR #4

**Дата:** 10 июля 2026  
**Ветка:** `main`  
**Статус:** реализация завершена, commit не создан (ожидает подтверждения)

---

## Цель

Локализация основных модулей первого демо-сценария на английский (по умолчанию) и русский с использованием существующей архитектуры `next-intl`.

**Охват PR #4:**
1. Dashboard
2. CRM / Clients (список)
3. Карточка клиента

**Вне охвата (намеренно):** Tasks, Calendar, Team Chat, AI Workspace целиком, Knowledge Base, Analytics, CRM Leads, New Formgrid Clients.

---

## Переведённые компоненты и файлы

### Dashboard
| Файл | Изменения |
|------|-----------|
| `src/app/(app)/dashboard/page.tsx` | Локализован `sectionTitle` |
| `src/components/dashboard/DashboardView.tsx` | Hero, статистика, задачи, team messages preview, quick actions → `dashboard.*` |
| `src/components/dashboard/DashboardTeamMessages.tsx` | Типы сообщений, empty state → `dashboard.teamMessages.*` |
| `src/lib/dashboard/stats.ts` | Сравнение статусов через `isClientStatus()` вместо русских литералов |

### CRM / Clients
| Файл | Изменения |
|------|-----------|
| `src/app/(app)/clients/page.tsx` | Заголовок и подзаголовок |
| `src/components/clients/ClientsList.tsx` | Поиск, таблица, pagination, empty/loading/error, источник данных |
| `src/app/api/clients/route.ts` | Локализованные ошибки API |
| `src/app/api/clients/filters/route.ts` | `unauthorized` |

### Карточка клиента
| Файл | Изменения |
|------|-----------|
| `src/app/(app)/clients/[id]/page.tsx` | Section title, subtitle |
| `src/components/clients/ClientDetailView.tsx` | Summary, панели, статус через `translateClientStatus` |
| `src/lib/google-sheets/client-detail-fields.ts` | `labelKey` вместо захардкоженных подписей |
| `src/components/clients/ClientNotes.tsx` | Форма, empty, ошибки API |
| `src/components/clients/ClientAiPanel.tsx` | Кнопки, модал, presets, ошибки |
| `src/app/api/clients/[id]/route.ts` | not found, unauthorized, load error |
| `src/app/api/clients/[id]/notes/route.ts` | validation, not found, save error |
| `src/app/api/clients/[id]/ai/route.ts` | unauthorized, not found |

### Инфраструктура i18n
| Файл | Назначение |
|------|------------|
| `src/i18n/statuses.ts` | Централизованный маппинг статусов RU/EN → ключ → перевод |
| `src/i18n/api-messages.ts` | Локализация API-ошибок по cookie `SPIORA_LOCALE` |
| `src/i18n/dictionaries/en.json` | +112 ключей (namespaces `dashboard`, `clients`, `statuses`, `api`) |
| `src/i18n/dictionaries/ru.json` | Полные русские переводы для новых namespaces |
| `src/i18n/i18n.test.ts` | +9 тестов для core modules |

---

## Количество i18n-ключей

| Метрика | Значение |
|---------|----------|
| Ключей в `en.json` до PR #4 | ~86 |
| Ключей в `en.json` после PR #4 | **198** |
| **Новых ключей** | **~112** |

Основные namespaces: `dashboard.*`, `clients.*`, `statuses.client.*`, `api.*`.

---

## Статусы клиентов (централизация)

Канонические ключи в `statuses.client.*`:

| Ключ | EN | RU | Алиасы в данных |
|------|----|----|-----------------|
| `new` | New | Новый | `New`, `Новый` |
| `in_progress` | In progress | В работе | `In progress`, `В работе` |
| `consultation` | Consultation | Консультация | `Consultation`, `Консультация` |
| `documents` | Document preparation | Подготовка документов | `Documents`, `Подготовка документов` |
| `completed` | Completed | Завершён | `Completed`, `Завершён` |
| `waiting` | Waiting | Ожидание | `Waiting` |
| `on_hold` | On hold | На паузе | `On hold` |
| `unspecified` | Not specified | Не указан | `—`, пусто |

Отображение: `translateClientStatus(locale, rawStatus)` — одинаково на списке и в карточке.

---

## API-сообщения (переведены)

| Ключ | EN | RU |
|------|----|----|
| `api.unauthorized` | Access denied | Доступ запрещён |
| `api.notFound` | Not found | Не найдено |
| `api.textRequired` | Note text is required | Текст заметки обязателен |
| `api.noteSaveFailed` | Failed to save note | Не удалось сохранить заметку |
| `api.loadClientsFailed` | Failed to load clients | Не удалось загрузить клиентов |
| `api.loadClientFailed` | Failed to load client | Не удалось загрузить клиента |

Внутренние логи и технические stack traces не переводятся.

---

## Русские строки, оставшиеся намеренно

| Место | Причина |
|-------|---------|
| `src/lib/dashboard/stats.ts` — regex `/консультац/i` | Бизнес-логика поиска консультаций в заметках (не UI) |
| `src/lib/google-sheets/client-detail-fields.ts` — JSDoc-комментарий | Не runtime UI |
| `src/components/clients/NewFormgridClientsList.tsx` | Вне scope PR #4 |
| Данные demo: имена, email, телефоны, статусы в raw-полях | Не переводятся по требованию |
| Бренд **Spiora**, **AI Workspace**, **AI Summary**, **Google Sheets**, **Email** | Намеренно не переводятся |
| `nav.dashboard` = «Dashboard» в ru.json | Сохранён английский термин (как в PR #3A) |

---

## Поиск mixed-language UI (кириллица в runtime-файлах)

### Dashboard — `src/components/dashboard/*`, `src/app/(app)/dashboard/*`
**Кириллицы в UI-строках нет** ✅

### Clients — `src/components/clients/*` (кроме NewFormgridClientsList)
**Кириллицы в UI-строках нет** ✅

### NewFormgridClientsList (вне scope)
Содержит русские строки — не затронут в PR #4.

### Lib (логика, не UI)
- `stats.ts` — regex для заметок (не отображается пользователю)

---

## Тесты

```
npm test
ℹ tests 346
ℹ pass 346
ℹ fail 0
```

**Новые/обновлённые тесты в `src/i18n/i18n.test.ts`:**
- Dashboard EN / RU labels
- Clients EN / RU labels
- API messages EN / RU
- Статусы: `New`/`Новый` → одинаковый перевод
- Неизвестный статус → raw fallback
- `buildPreserveRouteUrl` для `/clients/[id]` и query `search`

---

## Build

```
npm run build
✓ Compiled successfully
✓ Generating static pages (57/57)
```

Ошибок типизации и линтера нет.

---

## Smoke test (ручной сценарий)

> Автоматический HTTP-smoke на production-сервере не выполнялся: локальный `next start` после параллельного `next dev` дал ошибку stale webpack chunks. Рекомендуется ручная проверка после `npm run dev` (перезапуск dev-сервера).

### English (`SPIORA_LOCALE` отсутствует или `en`)
- [ ] `/dashboard` — «Welcome, …», «Statistics», «Quick actions»
- [ ] `/clients` — «Clients», placeholder «Search: name, passport…»
- [ ] Поиск клиента → открыть карточку
- [ ] Карточка: «Back to clients», статус на EN, AI modal на EN
- [ ] Empty states: «No notes yet», «No clients found»

### Русский (`POST /api/locale { "locale": "ru" }` + reload)
- [ ] `/dashboard` — «Добро пожаловать», «Статистика», «Быстрые действия»
- [ ] `/clients` — «Клиенты», «Поиск: имя, паспорт…»
- [ ] Карточка клиента: «К списку клиентов», статусы на RU
- [ ] Переключение языка **в карточке** — URL `/clients/{id}` сохраняется
- [ ] Query `?search=…` на `/clients` сохраняется при смене языка

---

## Diff summary

```
20 files changed, 798 insertions(+), 192 deletions(-)
```

**Новые файлы:**
- `src/i18n/statuses.ts`
- `src/i18n/api-messages.ts`

**Изменённые:** словари, компоненты dashboard/clients, API routes, тесты, `stats.ts`, `client-detail-fields.ts`.

---

## Git status

Ветка `main`, **remote отсутствует**, **commit не создан**.

---

## SAFE / NOT SAFE TO COMMIT

### SAFE TO COMMIT
- `src/i18n/dictionaries/en.json`, `ru.json`
- `src/i18n/statuses.ts`, `api-messages.ts`, `i18n.test.ts`
- Все изменённые компоненты dashboard/clients
- API routes `src/app/api/clients/**`
- `src/lib/dashboard/stats.ts`, `client-detail-fields.ts`
- `SPIORA_CORE_MODULES_I18N_REPORT.md`

### NOT SAFE TO COMMIT
- `.env.local`, `.env.development.local`
- `.data/`
- Любые файлы с секретами или production credentials

---

## Следующие шаги (после подтверждения)

1. Ручной smoke test в браузере (оба языка)
2. Commit по запросу: `Add Spiora core modules i18n for dashboard, clients, and client card`
3. PR #5+ — остальные модули (Tasks, Calendar, …)
