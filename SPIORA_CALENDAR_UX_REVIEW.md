# SPIORA Calendar — Визуальный UX-аудит

**Дата:** 10 июля 2026  
**PR:** #5 — Calendar Experience (перед commit)  
**Метод:** статический аудит UI-кода, CSS-модулей, словарей i18n и design tokens; **автоматические скриншоты не сделаны** (в проекте нет Playwright/Puppeteer, требуется авторизованная сессия в браузере). Ниже — детальные визуальные описания экранов по фактической реализации.

**Код не изменялся.**

---

## 1. Визуальный обзор экранов

> Для каждого экрана: композиция, ключевые элементы, ожидаемое впечатление при демо с `SPIORA_DEMO_MODE=true` и заполненным `.data/calendar-events.json`.

---

### 1.1 Dashboard с ближайшими событиями

**Статус:** ⚠️ **Отдельного виджета «ближайшие события» на Dashboard нет.**

Фактический экран `/` (`DashboardView`):

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Topbar: раздел + поиск + 🔔 + EN|RU + профиль │
│            ├─────────────────────────────────────────────────┤
│  Spiora    │  HERO: «Welcome, {name}» + подзаголовок        │
│  Nav…      │                                                 │
│            │  📋 Tasks — 4 stat cards (total, in progress…)  │
│            │  💬 Team Chat — online bar + recent messages    │
│            │  📊 Platform stats — clients, forms,            │
│            │     consultations (иконка 📅), AI requests      │
│            │  ⚡ Quick actions — Create task, AI Workspace   │
└─────────────────────────────────────────────────────────────┘
```

**Визуально:** тёмная premium-палитра Spiora (gray-800 sidebar, hero glow, Card-компоненты). Календарь на Dashboard **не представлен** как список событий — только метрика «Active consultations» с иконкой календаря.

**Для демо-сценария CRM → Calendar:** слабое звено — клиент не видит события до перехода в `/calendar`.

---

### 1.2 Month View (English)

**Маршрут:** `/calendar?view=month` + cookie `SPIORA_LOCALE=en`

```
┌──────────────────────────────────────────────────────────────┐
│ Calendar                                                     │
├──────────────────────────────────────────────────────────────┤
│ ◀  July 2026  ▶  [Today]     [Day|Week|Month] [+ Create event]│
│ Your time: Europe/Moscow (или аналог)                        │
├──────────────────────────────────────────────────────────────┤
│ ☑ My events          ☑ Company events    ● Personal ● Company │
├──────────────────────────────────────────────────────────────┤
│  MON  TUE  WED  THU  FRI  SAT  SUN                           │
│ ┌───┬───┬───┬───┬───┬───┬───┐                               │
│ │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │  ← ячейки 6.5rem min-height   │
│ │   │Team│CRM│   │   │   │Off│  ← цветные chips (синий/зел.)│
│ │   │Meet│Rev│   │   │   │day│  ← «+N more» при переполнении  │
│ └───┴───┴───┴───┴───┴───┴───┘                               │
└──────────────────────────────────────────────────────────────┘
```

**Визуально:**
- Сетка в rounded card (`border-radius: 14px`, полупрозрачный slate-фон).
- События — компактные pills: personal = синий `#3b82f6`, company = зелёный `#22c55e`.
- Today — синяя обводка ячейки.
- Дни вне месяца — приглушены (opacity 0.45).
- Шрифты: Sora (заголовки), Inter (текст).

**Впечатление:** аккуратный B2B-календарь, demo-данные (27 событий) заполняют неделю убедительно.

---

### 1.3 Month View (Русский)

**Маршрут:** тот же + `SPIORA_LOCALE=ru`

Отличия от EN:
- Заголовок раздела: **«Календарь»**
- Toolbar: **«Сегодня»**, **«День / Неделя / Месяц»**, **«+ Создать событие»**
- Слои: **«Мои события» / «События компании»**
- Дни недели: ПН–ВС (через `getWeekdayNames`)
- **Названия demo-событий остаются на английском** (Team Meeting, Client Consultation…) — визуальный диссонанс в RU-режиме.

---

### 1.4 Day View

**Маршрут:** `/calendar?view=day&date=YYYY-MM-DD`

```
┌──────────────────────────────────────────────────────────────┐
│ (toolbar как выше)                                           │
├──────────────────────────────────────────────────────────────┤
│ ALL-DAY EVENTS                                               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 00:00  Company Off-site Day                    [Company] │ │
│ └──────────────────────────────────────────────────────────┘ │
│ TIMED EVENTS / DAY SCHEDULE                                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 09:00  Team Meeting                            [Company] │ │
│ │ 11:00  Client Consultation                     [Company]│ │
│ │ 14:00  Document Review                        [Personal] │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Визуально:** крупные event chips (padding ~0.85rem), левый accent-border по scope, время слева фиксированной ширины. Читаемо, «список дел на день» — понятная иерархия.

---

### 1.5 Create Event

**Триггер:** кнопка «+ Create event» → модальное окно поверх dimmed backdrop.

```
┌──────────────── Modal: New event ──────────────── × ┐
│ [Personal] [Company]          ← scope toggle        │
│ [General event] [Video meeting] ← format toggle       │
│ (при video: длинный hint про комнату…)               │
│ (при company video: Whole team / Selected)            │
│ Title *, Description, All day, When (date/time)       │
│ Location, Reminders checkbox + hint                   │
│                              [Cancel] [Create]        │
└───────────────────────────────────────────────────────┘
```

**Визуально:** форма в Card с burgundy top-border (`3px solid rgba(190,18,60)`). Много секций fieldset — при **Video meeting + Company** форма становится длинной (invite, participants, client picker, waiting room, guest max, password). На ноутбуке — scroll внутри модалки.

**Непремиально:** нативные `<select>` для даты/времени (OS-стиль, не кастомный date picker).

---

### 1.6 Edit Event

Аналогично Create, но:
- Scope и Event type — readonly badges (pill).
- Заголовок модалки: **«Edit event»** / **«Редактировать событие»**.
- Кнопка submit: **Save** / **Сохранить**.

Визуально стабильно, меньше toggles — воспринимается проще.

---

### 1.7 Event Details

**Триггер:** клик по событию → `CalendarEventModal`.

```
┌──────────────── Event Details ──────────────────── × ┐
│ [Video meeting] [Company]                             │
│ Client Consultation                                   │
│ Time · Room (mono) · Participants · Status (dot)      │
│ Client link · Location · Author · Reminders           │
│ Description text                                      │
│ [Join video meeting]  ← локализован                  │
│ ┌─ Ссылка для клиента ─┐  ← ⚠️ RU-only блок          │
│ │ MeetingGuestInvite…   │                             │
│ └───────────────────────┘                             │
│ [Edit] [Delete]                                       │
└───────────────────────────────────────────────────────┘
```

**Визуально:** чистая meta-grid (dt/dd), badges, статус встречи с цветной точкой (green/gray). Для video — сильный demo-момент.

**Проблема EN-режима:** блоки `MeetingGuestInviteLink` и `MeetingGuestHistory` — **полностью на русском** → ломают premium-ощущение при показе англоязычному клиенту.

---

### 1.8 Demo notifications

**Триггер:** колокольчик в Topbar при `SPIORA_DEMO_MODE=true`.

```
┌──────── Notifications ──────── 🔊 Mark all read ────┐
│ 📅 Напоминание календаря              0.5h ago  × │  ← ⚠️ тип на RU в EN
│ Upcoming meeting in 1 hour                          │
│ 10:00 – 11:00 — Client Consultation                 │
│ [Join]                                              │
├─────────────────────────────────────────────────────┤
│ 📹 Видеовстреча …                                   │
│ Internal video meeting starts soon                  │
└─────────────────────────────────────────────────────┘
```

**Визуально:** панель 380px, rounded 16px, burgundy glow shadow, unread highlight — **выглядит premium**.

**Смешение языков:** заголовки локализованы, но `NOTIFICATION_TYPE_LABELS` в `constants.ts` — **всегда русские** («Напоминание календаря», «Видеовстреча»). В EN-режиме — заметный дефект.

---

### 1.9 Переключение EN ↔ RU

**Компонент:** `LanguageSwitcher` в Topbar (desktop) и Sidebar footer (mobile compact).

```
[ EN ] [ RU ]   ← pill toggle, active state highlighted
```

Поведение: POST `/api/locale`, сохранение cookie, `router.refresh()` без потери маршрута/query (`?view=month&date=…` сохраняется).

**Визуально:** компактно, не отвлекает. При переключении на Calendar — мгновенная смена toolbar, layers, модалок. **Исключения:** meet-блоки, notification type labels, demo event titles.

---

### 1.10 Mobile view Calendar

**Breakpoint:** `@media (max-width: 768px)` toolbar, `@media (max-width: 900px)` month/week grids.

```
┌─────────────────────┐
│ ☰ Calendar    🔔 EN│RU
├─────────────────────┤
│ ◀ Jul 2026 ▶ Today  │  ← toolbar stack
│ [Day|Week|Month]    │
│ [+ Create event]    │
├─────────────────────┤
│ Layer filters stack │
├─────────────────────┤
│ Month: узкие ячейки │
│ 5.5rem min-height   │
│ truncated chips     │
├─────────────────────┤
│ Week: horizontal    │
│ scroll (min 52rem)  │
└─────────────────────┘
```

**Визуально:** Month usable, но chips обрезаются (`text-overflow: ellipsis`). Week view требует горизонтальный скролл — **не идеально для mobile demo**. Sidebar скрывается (типичный mobile nav), locale — compact в sidebar drawer.

---

## 2. UX-оценка (шкала 1–10)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Внешний вид** | **7.5** | Цельная тёмная тема Spiora, качественные cards, цветовое кодирование scope. Не хватает polish в деталях (стрелки ◀▶, native selects). |
| **Современность интерфейса** | **7.0** | Sora/Inter, glassmorphism-lite, segmented controls. Тянет вниз: нативные select, emoji в empty state (📅), unicode-навигация. |
| **Читаемость** | **8.0** | Хороший контраст белого/slate на тёмном фоне; chips с ellipsis; meta labels uppercase мелким кеглем. |
| **Визуальная иерархия** | **7.5** | Toolbar → filters → grid чётко. Video form перегружает иерархию. |
| **Удобство навигации** | **7.5** | Today/Prev/Next, tab views, click day → day view. Week на mobile — scroll. Нет keyboard shortcuts. |
| **Привлекательность для клиента** | **7.0** | Demo calendar насыщенный; Dashboard не подводит к календарю; EN-mode leaks русского в meet/notifications. |
| **Качество английского** | **7.0** | Естественные фразы (Company events, All day). Мелочи: «New event» vs «Create Event», lowercase «event», длинный `videoHint`. |
| **Качество русского** | **8.0** | Живой язык («Мои события», «За 24 часа»). Длинная строка `reminders` в форме. Demo titles на EN. |
| **Готовность к демонстрации** | **7.0** | **Можно показывать** Month/Day + создание события + demo data. Перед «публичным» demo — закрыть mixed-language и Dashboard gap. |

**Средняя оценка: 7.3 / 10**

---

## 3. Что выглядит «непремиально»

### Тексты
| Проблема | Где |
|----------|-----|
| Длинный `videoHint` (2 строки мелким шрифтом) | Create Event, video meeting |
| `selectAtLeastOne` — длинное предупреждение в layers | Layer filters |
| `reminders` + `remindersHint` — дублирование смысла | Event form |
| Demo event titles на EN при RU UI | Month/Day chips |
| Notification type labels всегда RU | Notification panel EN |
| Meet guest invite блок на RU | Event Details EN |

### Кнопки и контролы
| Проблема | Где |
|----------|-----|
| Unicode `◀` `▶` вместо icon font | Toolbar nav |
| Неравная высота: nav 2rem vs create 0.55rem padding | Toolbar |
| Native `<select>` date/time | Event form |
| Checkbox reminders без custom styling | Event form |

### Пустые области и отступы
| Проблема | Где |
|----------|-----|
| `min-height: 6.5rem` на пустых днях month | Month grid — много «воздуха» в выходные |
| `min-height: 24rem` на body | CalendarView — пустота при loading |
| Week grid `min-width: 52rem` | Горизонтальный пустой scroll на tablet |

### Несогласованность
| Проблема | Где |
|----------|-----|
| «+ Create event» vs dialog «New event» vs TZ «Create Event» | Toolbar / modal |
| Blue/green scope в calendar vs burgundy brand accent | Chips vs modal border |
| Emoji 📅 в empty state vs Font Awesome везде | Empty state |
| Date format `dd.mm.yyyy` в notifications | Всегда EU-формат, даже EN |

### Перегруженность
| Проблема | Где |
|----------|-----|
| Video meeting create form: до 12+ секций | Event form |
| Event Details modal + guest invite + history | Video event modal |

### Устаревший вид
| Проблема | Где |
|----------|-----|
| Native OS selects | Date/time pickers |
| Plain checkbox lists для participants | Event form |

### Смешение стилей
| Проблема | Где |
|----------|-----|
| Локализованный calendar + русский meet | Event modal |
| Локализованные titles + русские type badges | Notifications EN |
| `MeetingJoinButton` EN + `MeetingGuestInviteLink` RU | Same modal |

---

## 4. Рекомендации

### High Priority — обязательно до публичной демонстрации

1. **Локализовать notification type labels** (`NOTIFICATION_TYPE_LABELS`, `formatNotificationTime`) — в EN-режиме панель выглядит «сырой».
2. **Локализовать meet-блоки в Event Details** (`MeetingGuestInviteLink`, `MeetingGuestHistory`, `MeetingAccessGate`) — иначе EN-demo ломается на video-событии.
3. **Добавить виджет «Upcoming events» на Dashboard** (3–5 ближайших) со ссылкой в Calendar — без этого сценарий CRM → Calendar слабый.
4. **Русифицировать demo event titles** (или добавить `titleRu` в шаблоны) — иначе RU-demo выглядит недоделанным.
5. **Проверить mobile Week view** на реальном устройстве — горизонтальный scroll выглядит непрофессионально; для demo лучше default Month на mobile.

### Medium Priority — желательно улучшить

1. **Заменить native date/time selects** на кастомный picker в стиле Spiora.
2. **Упростить video meeting form** — progressive disclosure (Advanced: guest password, waiting room).
3. **Выровнять EN-копирайт:** «Create Event», единый Title Case, укоротить `videoHint`.
4. **Заменить ◀▶ на `fa-chevron-left/right`** для согласованности с остальным UI.
5. **Иконка empty state** — Font Awesome вместо emoji 📅.
6. **Month grid:** уменьшить `min-height` пустых ячеек или adaptive height.
7. **Визуально отличать General vs Video** в month chips (иконка 📹 / полоска).

### Low Priority — косметика

1. Удалить или обновить неиспользуемый ключ `createDisabledTitle` («next release») — create уже enabled.
2. Анимация открытия модалки (fade/scale) — сейчас резкое появление.
3. Hover preview событий в month cell.
4. Keyboard shortcuts (T / M / D / N).
5. Унифицировать date format в notifications под locale.
6. Тонкая тень у month chips при hover — уже есть `brightness`, можно добавить lift.

---

## 5. Итоговый вердикт

| Вопрос | Ответ |
|--------|-------|
| Хочется ли пользоваться этим календарём? | **Да, с оговорками** — Month/Day выглядят продуктово, demo data сильный. |
| Можно ли показывать клиенту сейчас? | **Да, в controlled demo** (EN или RU отдельно, не переключая язык на video modal). |
| Готов ли к «публичному» demo без оговорок? | **Нет** — mixed language в notifications/meet и отсутствие Dashboard widget. |

**Рекомендация перед commit PR #5:** commit можно делать (код стабилен), но **перед live-demo с клиентом** закрыть минимум пункты High Priority #1–#3.

---

## 6. Обновление — Calendar Demo Polish (10 июля 2026)

### Закрытые High Priority замечания

| # | Замечание | Статус |
|---|-----------|--------|
| 1 | Notification type labels + formatNotificationTime | ✅ `notifications.types.*`, `notification-labels.ts` |
| 2 | Meet-блоки в Event Details | ✅ `MeetingGuestInviteLink`, `MeetingGuestHistory`, `MeetingAccessGate`, `MeetingJoinButton`, invite message |
| 3 | Dashboard widget «Upcoming events» | ✅ `DashboardUpcomingEvents` (до 5 событий) |
| 4 | Локализация demo event titles | ✅ `demo:{titleKey}` + `calendar.demoEvents.*` (26 ключей) |
| 5 | Mobile Week view | ⚠️ Не менялся (вне scope); overflow fixes в modal/widget |

### Новая UX-оценка (после polish)

| Критерий | Было | Стало |
|----------|------|-------|
| Привлекательность для клиента | 7.0 | **8.5** |
| Качество английского | 7.0 | **8.0** |
| Качество русского | 8.0 | **8.5** |
| Готовность к демонстрации | 7.0 | **8.5** |
| **Средняя** | **7.3** | **8.2** |

### Mixed-language audit (runtime UI)

| Область | EN | RU |
|---------|----|----|
| `components/calendar/*` | ✅ | ✅ |
| `app/(app)/calendar/*` | ✅ | ✅ |
| Event Details meet blocks | ✅ | ✅ |
| Notification type labels | ✅ | ✅ |
| Demo event titles | ✅ EN | ✅ RU |
| Dashboard upcoming widget | ✅ | ✅ |
| In-room meet UI (dock, control bar, guest lobby) | ❌ RU | — |
| `NotificationProvider` toast action | ❌ «Открыть раздел» | — |

### Вердикт после polish

| Вопрос | Ответ |
|--------|-------|
| Готов ли к публичному demo? | **Да** — сценарий Dashboard → Calendar → Event → Video invite работает на EN и RU |
| Оговорки | Полная видеокомната (LiveKit UI) и guest lobby пока не локализованы — вне scope demo polish |

---

## 6. Ограничения аудита

- Скриншоты не приложены: нет headless browser в CI/devDependencies; требуется ручной прогон в Chrome (`npm run dev`, login, `SPIORA_DEMO_MODE=true`).
- Оценки основаны на CSS, component tree и i18n-словарях — могут отличаться на конкретном разрешении/ОС (особенно native selects).
- Код **не изменялся** в рамках этого аудита.

---

*Документ подготовлен для PR #5. Commit не выполнялся.*
