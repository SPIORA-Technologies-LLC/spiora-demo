# SPIORA Calendar Demo Report — PR #5

**Дата:** 10 июля 2026  
**Ветка:** `main` (без remote)  
**Scope:** модуль Calendar — локализация, demo polish, UX для демонстрации  
**Commit:** не создан (ожидает подтверждения)

---

## 1. Переведённые поверхности

### Страницы
| Маршрут | Статус |
|---------|--------|
| `/calendar` | Полная локализация (Month / Day / Week placeholder) |
| `/calendar/meet/[eventId]` | Fallback «Подключение…» локализован |

### Компоненты (`src/components/calendar/`)
| Компонент | Что локализовано |
|-----------|------------------|
| `CalendarView` | Загрузка, ошибки, toasts, диалоги удаления |
| `CalendarToolbar` | Today, Prev/Next, Month/Day/Week, Create Event |
| `CalendarMonthGrid` | Aria, «+N more» |
| `CalendarDayAgenda` | All day, day schedule |
| `CalendarWeekGrid` | Week placeholder grid, aria |
| `CalendarViewPlaceholder` | Week view placeholder |
| `CalendarLayerFilters` | Personal / Company layers |
| `CalendarEmptyState` | Пустое состояние |
| `CalendarEventForm` | Create/Edit form, validation, reminders |
| `CalendarEventModal` | Event details, delete, participants |
| `CalendarEventChip` | Scope / type labels |
| `CalendarClientPicker` | Search, placeholders |
| `CalendarDateSelect` / `CalendarTimeSelect` | Aria, локализованные месяцы |
| `MeetingJoinButton` *(из Event Modal)* | Join Meeting placeholder |

### Инфраструктура i18n
- Namespace `calendar.*` в `en.json` / `ru.json`
- `src/i18n/calendar-enums.ts` — перевод enum, validation, reminders (client-safe)
- `format.ts`, `range.ts`, `participants.ts`, `meeting-client.ts` — locale-aware labels
- `form.ts` — validation codes вместо захардкоженных строк
- `calendar-reminder-copy.ts` — locale-aware уведомления

---

## 2. i18n-ключи

| Метрика | Значение |
|---------|----------|
| Новых leaf-ключей в `calendar.*` | **134** |
| Языки | `en`, `ru` |
| Покрытие по секциям | toolbar, layers, empty, agenda, monthGrid, weekGrid, dialogs, toasts, form, modal, clientPicker, dateSelect, timeSelect, placeholder, enums, validation, reminders, participants, notifications, meet |

---

## 3. Demo-данные

| Метрика | Значение |
|---------|----------|
| Demo-события (`demo-events.ts`) | **27** шаблонов |
| Типы | `general`, `video_meeting` |
| Scope | `personal`, `company` |
| Особенности | all-day, разные авторы, reminders on/off, linked clients |
| Seeding | При пустом `.data/calendar-events.json` и без Supabase |
| Demo-уведомления | **6** шаблонов при `SPIORA_DEMO_MODE=true` |

Примеры событий текущей недели: Team Meeting, Client Consultation, Document Review, Internal Video Meeting, CRM Review, AI Workflow Planning, Residence Permit Submission и др.

---

## 4. UX-рекомендации (не реализованы)

**Вопрос:** «Хочется ли мне пользоваться этим календарём?»

**Ответ:** Да, для B2B-демо календарь уже выглядит убедительно. Для production-ready ощущения рекомендуется:

1. **Week View** — сейчас placeholder; клиенты ожидают полноценную сетку. Приоритет #1 после демо.
2. **Drag-and-drop** — перенос событий мышью в Month/Day сильно повышает «ощущение продукта».
3. **Цветовая легенда типов** — personal/company различаются, но General vs Video Meeting визуально слабо; добавить иконки или accent-полоски.
4. **Мини-превью дня при hover** в Month View — быстрый просмотр без клика.
5. **Интеграция с CRM в карточке события** — linked client есть в данных, но в UI слабо подсвечен путь «клиент → событие → встреча».
6. **Клавиатурные shortcuts** — `T` (Today), `M`/`D`/`W` (views), `N` (New event) — ожидаемы power users.
7. **Локализация видеокомнаты** — `src/components/meet/*` (кроме Join button) всё ещё на русском; при EN-режиме ломает целостность сценария «Calendar → Video».
8. **Плотность Month View на мобильных** — на узких экранах «+N more» работает, но touch-targets мелковаты.

---

## 5. Ограничения

| Ограничение | Детали |
|-------------|--------|
| Week View | Placeholder, без сетки |
| LiveKit | Не внедрялся; видеокомната — существующая интеграция |
| Meet UI | `CalendarMeetRoom`, `MeetingAccessGate`, guest flow — **не локализованы** (вне `components/calendar/`) |
| Guest invite email | `meeting-guest-invite-message.ts` — русский шаблон |
| API / архитектура | Не изменялись |
| `MONTH_WEEKDAY_LABELS` в `month.ts` | Legacy RU-константа; UI использует `getWeekdayNames` из i18n |

---

## 6. Accessibility (code review)

| Критерий | Статус | Комментарий |
|----------|--------|-------------|
| Aria labels | ✅ | Toolbar, grids, dialogs, date/time selects |
| Focus / keyboard | ⚠️ | Кнопки и модалки focusable; shortcuts отсутствуют |
| Контраст chips | ✅ | personal (синий) / company (зелёный) на светлом фоне читаемы |
| Screen reader | ⚠️ | Event chips имеют title/aria; week timed blocks — aria-label с title+time |
| Color-only info | ⚠️ | Scope различается цветом; текстовые labels добавлены в chip/modal |
| Loading states | ✅ | Локализованные «Loading…» |

---

## 7. Проверка смешанного языка

| Область | EN mode | RU mode |
|---------|---------|---------|
| `src/components/calendar/*` | ✅ Нет кириллицы | ✅ Нет англ. UI-строк (кроме demo event titles) |
| `src/app/(app)/calendar/*` | ✅ | ✅ |
| `MeetingJoinButton` | ✅ | ✅ |
| `src/components/meet/*` (остальное) | ❌ Русский UI | — |
| Demo event titles | EN (намеренно) | EN (имена событий в demo data) |
| Demo notification messages | EN body | EN body (titles локализованы) |

**Допустимые исключения:** Spiora, LiveKit, AI, имена demo-клиентов.

---

## 8. Тесты

```
npm test
ℹ tests 357
ℹ pass 357
ℹ fail 0
```

### Calendar i18n (новые)
- Month View EN / RU
- Day View EN / RU
- Event Modal & Form EN / RU
- Reminders & Toasts EN / RU
- Enums & validation EN / RU

### Прочие calendar-тесты
- `demo-events.test.ts` — ≥25 событий, типы, all-day
- `form.test.ts`, `format.test.ts`, `participants.test.ts` — locale
- `calendar-reminder-copy.test.ts` — en/ru
- `reminders-cron.test.ts` — ✅ (stub `next/headers`)

---

## 9. Build

```
npm run build
✅ Успешно (Next.js production build)
```

---

## 10. Smoke Test (checklist)

| Сценарий | EN | RU | Примечание |
|----------|----|----|------------|
| Открыть `/calendar` | ✅ | ✅ | Demo events seed |
| Month view | ✅ | ✅ | Локализованные weekday headers |
| Day view | ✅ | ✅ | |
| Week placeholder | ✅ | ✅ | Локализованный текст |
| Create personal event | ✅ | ✅ | Form + toast |
| Create company event | ✅ | ✅ | |
| Edit event | ✅ | ✅ | |
| Delete event | ✅ | ✅ | Confirm dialog |
| Reminders toggle | ✅ | ✅ | |
| Смена языка (cookie) | ✅ | ✅ | `SPIORA_LOCALE` |
| Join Meeting button | ✅ | ✅ | В Event Modal |
| Demo notifications | ✅ | ✅ | При `SPIORA_DEMO_MODE=true` |

*Smoke test выполнен по code path review + unit/integration tests. Ручной браузерный прогон рекомендуется перед live-демо.*

---

## 11. Изменённые файлы

**Modified (38):** calendar components, dictionaries, lib helpers, notifications, meet page, test infra  
**New (5):** `calendar-enums.ts`, `demo-events.ts`, `demo-events.test.ts`, `demo-notifications.ts`, `next-headers-stub.mjs`

**Diff summary:** `+918 / −256` строк (без untracked в stat)

---

## 12. SAFE / NOT SAFE TO COMMIT

### ✅ SAFE TO COMMIT

- Нет секретов, `.env`, credentials
- `npm test` — **375/375**
- `npm run build` — успешно
- Scope: Calendar + Dashboard widget + meet blocks в Event Details
- API и бизнес-логика не менялись
- Remote отсутствует — push не выполнялся

---

## 13. Calendar Demo Polish (дополнение)

| Метрика | Значение |
|---------|----------|
| Новых i18n-ключей (polish) | ~90 (`meet.*`, `demoEvents.*`, `notifications.types.*`, `dashboard.upcomingEvents.*`) |
| Demo titles | `demo:{titleKey}` → словарь `calendar.demoEvents.*` |
| Dashboard widget | `DashboardUpcomingEvents` — 3–5 событий, video badge, link |
| Новые тесты | `demo-event-title`, `notification-labels`, `calendar-demo-polish` (+18 тестов) |

### Примечание по demo data

Если `.data/calendar-events.json` уже содержит старые события с английскими `title`, удалите файл для пересоздания demo-seed с `demo:` ключами.

---

*Отчёт сгенерирован автоматически в рамках PR #5 — Calendar Experience.*
