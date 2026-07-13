# SPIORA — PR #12: First Impression

**Дата:** 12 июля 2026  
**Статус:** Spec only — код не пишется в этом документе  
**Заменяет:** `SPIORA_EXECUTIVE_DASHBOARD_POLISH_SPEC.md` (Executive Dashboard → устарело)  
**Сдвигает roadmap:** Demo Reset → **PR #13**, infra → PR #14+

---

## Одна строка цели

> У директора есть **15 секунд** после login.  
> За это время он должен подумать: **«Это вообще не похоже на Битrix.»**

Мы работаем **не над Dashboard**.  
Мы работаем над **первыми 15 секундами**.

---

## Продуктовая переупаковка

### Было (конкурирует с Bitrix)

- «Corporate Digital Workspace»
- «корпоративная платформа»
- Dashboard · CRM · Knowledge Base · Analytics

### Стало (конкурирует со способом управления компанией)

**Primary tagline (EN):**

> **Spiora — AI-powered Operating System for Business**

**Alternative (EN):**

> **The Operating System for Modern Companies**

**RU (предложение):**

> **Spiora — AI-операционная система для бизнеса**

**Правило:** на First Impression Screen, login, metadata — **не** «platform», **не** «workspace», **не** «CRM suite».

---

## Что продаём

| Не продаём | Продаём |
|------------|---------|
| CRM | **Контроль над компанией** |
| Knowledge Base | **Company Knowledge** |
| Analytics | **Business Insights** |
| 4 meetings, 2 tasks | **Спокойствие владельца** |

**Психология:** покупатель не покупает функции. Он покупает ощущение, что **всё под контролем**.

---

## First Impression Screen

**Не называть внутри продукта «Dashboard».**

| Вариант nav label | EN | RU (предлож.) |
|-------------------|-----|---------------|
| **Рекомендуется** | **Command Center** | **Центр управления** |
| Альтернатива A | Overview | Обзор |
| Альтернатива B | Home | Главная |

**Route:** `/dashboard` можно оставить технически; **visible label** — Command Center (или выбранный вариант).

**Экран отвечает на один вопрос:**

> **Что происходит в моей компании прямо сейчас?**

---

## Анатомия экрана (wireframe copy)

Сверху вниз. Всё above the fold или с минимальным scroll.

### Block 1 — Morning greeting *(спокойствие, не тревога)*

```
Good morning, Olivia 👋

Everything is under control.

AI analysed overnight activity.
```

**RU:**

```
Доброе утро, Olivia 👋

Всё под контролем.

AI проанализировал активность за ночь.
```

**Тон:** уверенный chief-of-staff, не системный лог.

---

### Block 2 — Today *(статус светофором + язык бизнеса)*

**Не:** «4 meetings» · **Да:** контекст + цвет

```
Today

🟢 4 meetings — everything is on schedule
🟡 3 clients waiting for documents
🔴 2 tasks require your attention
🟢 1 residence permit approved
```

**Правило calm copy:**

| ❌ Feature-speak | ✅ Owner-speak |
|-----------------|----------------|
| 4 meetings | Everything is on schedule |
| 2 overdue tasks | Two tasks require your attention |
| 18 documents | 18 client documents are waiting for review |
| 3 clients waiting | Three clients are waiting for your team |

---

### Block 3 — AI Insights *(WOW #1)*

```
AI Insights

• Sofia Martins is missing one document
• Daniel has 6 overdue tasks
• Two consultations can be merged
```

**Поведение:** demo-seeded insights из clients/tasks/calendar; клик → AI Workspace или Client Card.

**Эффект:** «AI уже работал, пока я спал.»

---

### Block 4 — Ask Spiora *(WOW #2 — AI не в меню, AI на главном)*

```
Ask Spiora

[ Show today's priorities ]
[ Which clients are at risk? ]
[ Draft an email to Sofia Martins ]
```

**Поведение:** chips → AI Workspace с prefilled prompt (существующие presets OK).

**Не писать:** «Open AI Workspace module».

---

### Block 5 — Company Health *(масштаб)*

```
Company Health    🟢 Excellent

126 Clients
3,482 Documents
84 Meetings
421 AI conversations
```

**Цифры — synthetic demo.** Мозг CEO: *«Ого…»* — масштаб компании на 80 человек.

---

### Block 6 — Team Activity *(система живая)*

```
Team Activity

Emma uploaded passport
Daniel scheduled consultation
Lucas completed checklist
```

**Не «Team Chat preview».** **История**, не виджет.

---

## Переименования в навигации (PR #12 scope)

| Было (EN) | Стало (EN) | RU (предлож.) |
|-----------|------------|---------------|
| Dashboard | **Command Center** | Центр управления |
| Knowledge Base | **Company Knowledge** | База знаний компании |
| Analytics | **Business Insights** | Бизнес-аналитика |
| Clients | Clients *(без изменений)* | Клиенты |

**Не трогать в PR #12:** Lead Review, Formgrid, 15 пунктов меню — порядок и иконки polish optional, **не удалять**.

**i18n keys:** `nav.dashboard` → label change; namespace `knowledgeBase` / `analytics` — **только nav labels**, не refactor всего namespace.

---

## Где меняется tagline

| Место | Было | Стало |
|-------|------|-------|
| Login subtitle | Corporate Digital Workspace | AI-powered Operating System for Business |
| `branding.productDescription` | Corporate Digital Workspace | AI-powered Operating System for Business |
| Metadata / OG | …Corporate Digital Workspace… | …AI-powered Operating System… |
| First Impression hero | Spiora Workspace | *(не дублировать — greeting персональный)* |

---

## Что убрать с First Impression Screen

| Убрать / минимизировать | Почему |
|-------------------------|--------|
| Badge «Demo data» на hero | Ломает illusion |
| KPI grid «Clients in CRM / New applications» | System-speak |
| Emoji 📋 в заголовках секций | Boardroom tone (👋 в greeting — OK) |
| Слово «Dashboard» в UI | Устаревшее; Bitrix-vibe |
| Quick actions «Create task» как hero | Operations, not owner calm |

---

## Что сохранить (compact, не hero)

| Элемент | Размещение |
|---------|------------|
| Upcoming meeting (next 1) | Inline в Today или footer |
| Team online | Compact strip |
| Drill-down links | Insights → client; Ask Spiora → AI |

---

## Out of scope (PR #12)

| Не в этом PR | Когда |
|--------------|-------|
| CRM card-view / client card redesign | PR #14 |
| Demo Reset | **PR #13** |
| Supabase / Vercel | PR #14+ |
| Analytics placeholder tabs | PR #15 |
| Live LLM on home screen | Optional; chips → AI Workspace достаточно |
| Rename route `/dashboard` → `/command-center` | Optional; label-only OK for v1 |

---

## Acceptance criteria

1. **15-second test:** новый viewer после login видит greeting + «Everything is under control» + Today + AI Insights **without scroll** (desktop 1440px).
2. **Bitrix test:** ни одного «Dashboard», «Corporate Platform», «CRM module» на First Impression Screen.
3. Nav label: **Command Center** (или зафиксированный выбор заказчика).
4. Nav: **Company Knowledge**, **Business Insights**.
5. Tagline login + branding: **AI-powered Operating System for Business**.
6. Copy audit: Today block uses **owner-speak**, not raw counts alone.
7. Synthetic scale: 126 clients, 3482 documents visible in Company Health.
8. EN + RU i18n.
9. No «Demo data» badge on First Impression hero.
10. `npm test` + `npm run build` pass.
11. `/dashboard` URL continues to work (redirects/bookmarks).

---

## Implementation map (hint)

```
src/components/dashboard/          → rename conceptually to first-impression/
  FirstImpressionView.tsx          — replaces DashboardView layout
  MorningGreeting.tsx
  TodayStatusPanel.tsx             — 🟢🟡🔴 owner-speak
  AiInsightsPanel.tsx
  AskSpioraPanel.tsx
  CompanyHealthPanel.tsx
  TeamActivityFeed.tsx

src/lib/dashboard/
  first-impression-seed.ts         — insights, activity, scale numbers
  owner-speak.ts                   — copy helpers EN/RU

src/i18n/dictionaries/
  nav.commandCenter                — new label key (or relabel dashboard)
  firstImpression.*                  — all screen copy
  nav.companyKnowledge             — label
  nav.businessInsights             — label

src/config/branding.ts             — productDescription update
```

---

## Roadmap (обновлённый)

```
PR #11   Critical Fixes          ✅ done
PR #11.5 Executive Demo Review   ✅ done
PR #12   First Impression         ← THIS (15 seconds, Command Center, tagline)
PR #13   Demo Reset
PR #14   Client Card polish
PR #15   Business Insights tabs
PR #16+  Infra (Supabase, Vercel, GitHub)
```

**Если один PR:** First Impression > всё остальное.

---

## Конкурентный framing (для sales)

| Конкурент | Как они позиционируют home |
|-----------|----------------------------|
| Microsoft Copilot | AI-first home |
| Notion AI | Workspace + ask |
| Linear | Overview, not dashboard |
| ClickUp | Home / Hub |
| Atlassian | Work hub |

Spiora First Impression = **Command Center + overnight AI + owner calm** — не таблица KPI.

---

## Связь с документами

| Документ | Статус |
|----------|--------|
| `SPIORA_EXECUTIVE_DEMO_REVIEW.md` | Baseline review |
| `SPIORA_EXECUTIVE_DASHBOARD_POLISH_SPEC.md` | **Superseded** → этот файл |
| **Этот spec** | Canonical PR #12 |

---

## Решение для заказчика (выбрать до implementation)

1. **Nav label:** Command Center / Overview / Home — **рекомендуем Command Center**
2. **Tagline:** «AI-powered Operating System for Business» vs «The Operating System for Modern Companies»
3. **👋 в greeting:** оставить / убрать

---

*Spec v2 — strategy correction от заказчика, 12 июля 2026. Код не изменялся.*
