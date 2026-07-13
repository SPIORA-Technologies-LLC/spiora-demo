# SPIORA — First Impression Report (PR #12)

**Дата:** 13 июля 2026  
**PR:** #12 — First Impression Experience  
**Статус:** реализовано, без commit / push / deploy

---

## 1. Цель

После login пользователь видит **Command Center** — AI Operating System for Business, а не классический Dashboard/CRM. Первые 15 секунд должны вызывать ощущение: *«Это не похоже на Битrix»*.

---

## 2. Что изменено

### Branding и логотип

| Элемент | Было | Стало |
|---------|------|-------|
| Логотип | `spiora-logo.svg`, `spiora-mark.svg` | **`logo1.svg`** (единственный asset) |
| Слоган EN | Corporate Digital Workspace | **The AI Operating System for Business** |
| Слоган RU | Корпоративное цифровое пространство | **AI-операционная система для бизнеса** |
| Accent | `#910d0d` burgundy | **`#ff9a03` → `#e82916`** (градиент нового бренда) |
| Nav label | Dashboard | **Command Center** / **Центр управления** |

### Первый экран (Command Center)

Заменён `DashboardView` на **`FirstImpressionView`**:

1. **Hero / Greeting** — Good morning + Everything is under control + overnight AI brief  
2. **Today's Executive Summary** — 4 строки owner-speak (demo EN/RU)  
3. **Your Priorities** — 4 карточки 🟢🟡🔴 без технического языка  
4. **AI Insights** — 3 пункта с ссылками на клиента/задачи/календарь  
5. **Ask Spiora** — 5 chips → demo navigation (AI Workspace / Calendar)  
6. **Company Health** — Excellent + synthetic scale (126 clients, 3482 documents…)  
7. **Team Activity** — живая лента из 5 demo-событий  

### Анимации

| Анимация | Где |
|----------|-----|
| `fadeInUp` | все секции Command Center (staggered delay) |
| Hover lift | priority cards, chips, panels |
| **BootSplash** | logo fade-in + power glow pulse при первом входе в сессию |
| Panel border glow | orange accent on hover |

### Demo badges

На Command Center hero **нет** badge «Demo data». Demo-контент подаётся как уверенный executive briefing.

---

## 3. Изменённые экраны

| Экран | Изменение |
|-------|-----------|
| **Login** | logo1.svg, убран дублирующий заголовок «Spiora» |
| **Command Center** (`/dashboard`) | полностью новый layout |
| **Sidebar** | новый логотип, label «Command Center» |
| **Topbar** | title «Command Center» |
| **404 / 500** | новый логотип через `Logo` component |
| **PWA / favicon** | иконки перегенерированы из logo1.svg |
| **Boot splash** | overlay при первом заходе в app shell |

**Не изменялись (по ТЗ):** CRM, Calendar, AI Workspace, Chat, Analytics, KB, Settings, Tasks, API.

---

## 4. Где используется logo1.svg

| Путь | Назначение |
|------|------------|
| `public/logo1.svg` | runtime asset |
| `logo1.svg` (root) | исходник |
| `src/app/icon.svg` | Next.js favicon |
| `branding.logoPath` | Login, Sidebar, Logo component |
| `branding.iconPath` | metadata |
| `branding.faviconPath` | layout icons |
| `public/sw.js` | PWA precache |
| `public/icons/*.png` | PWA (generated from logo1.svg) |

---

## 5. Удалённые старые логотипы

- `public/spiora-logo.svg` — **удалён**
- `public/spiora-mark.svg` — **удалён**

В runtime-коде ссылок на старые assets **нет**.

---

## 6. Новые файлы PR #12

```
src/components/dashboard/FirstImpressionView.tsx
src/components/dashboard/FirstImpressionView.module.css
src/components/dashboard/AskSpioraPanel.tsx
src/components/dashboard/BootSplash.tsx
src/components/dashboard/BootSplash.module.css
src/lib/dashboard/first-impression-seed.ts
src/lib/dashboard/first-impression.test.ts
public/logo1.svg
```

---

## 7. i18n

Новый namespace **`commandCenter`** (~40 ключей EN + RU):

- greeting, calmHeadline, heroLead  
- executiveSummary.*  
- priorities.*  
- insights.*  
- askSpiora.*  
- companyHealth.*  
- activity.*  

`nav.dashboard` → Command Center / Центр управления  
`metadata.description` → новый слоган

---

## 8. Тесты

```
492 pass / 0 fail / 179 suites
```

Новый файл: `src/lib/dashboard/first-impression.test.ts`

---

## 9. Build

```
npm run build — ✅ success (58 pages)
```

---

## 10. Mobile

Command Center responsive breakpoints:

- **900px** — health grid 2 col, priorities 1 col  
- **768px** — уменьшенные paddings  
- **390px** — chips full-width  
- **320px** — compact panels  

---

## 11. SAFE / NOT SAFE TO COMMIT

**✅ SAFE TO COMMIT** после review:

- тесты и build проходят  
- нет secrets  
- logo1.svg — публичный brand asset  

**⚠️ Примечание:** git status содержит также незакоммиченные изменения PR #11 (Tasks i18n, error pages, login rate limit и др.). Рекомендуется **отдельный commit** для PR #12 или rebase/split перед push.

---

*Отчёт подготовлен по завершении PR #12 First Impression Experience.*
