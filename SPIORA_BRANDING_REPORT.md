# Spiora — отчёт PR #2: Branding

**Дата:** 10 июля 2026  
**Статус:** реализация завершена, commit **не выполнен** (ожидает подтверждения)

---

## Цель

Заменить временный и исходный брендинг на единый бренд **Spiora** без изменения локализации, demo data и бизнес-логики.

---

## Центральный конфиг

**`src/config/branding.ts`**

| Поле | Значение |
|---|---|
| `productName` | Spiora |
| `productShortName` | Spiora |
| `productDescription.en` | Corporate Digital Workspace |
| `productDescription.ru` | Корпоративное цифровое пространство |
| `companyName` | Spiora *(demo tenant, не продукт)* |
| `logoPath` | `/spiora-logo.svg` |
| `iconPath` / `faviconPath` | `/spiora-mark.svg` |
| `theme` | dark |
| `primaryColor` | `#1a202c` |
| `accentColor` | `#910d0d` |
| `liveKitRoomPrefix` | `spiora-cal` |

Хелперы: `getSiteMetadata()`, `getManifestConfig()`, `getMeetingRoomName()`, `getProductDescription()`.

---

## Новые файлы

| Файл | Назначение |
|---|---|
| `src/config/branding.ts` | Централизованный branding config |
| `src/config/branding.test.ts` | Тесты metadata, manifest, scan legacy |
| `src/app/manifest.ts` | Динамический PWA manifest из branding |
| `public/spiora-logo.svg` | Логотип (desktop, sidebar, login) |
| `public/spiora-mark.svg` | Иконка/mark (favicon, PWA source) |

---

## Удалённые файлы

| Файл | Причина |
|---|---|
| `public/logo.svg` | Старый Northstar logo |
| `public/manifest.json` | Заменён на `src/app/manifest.ts` |

---

## Изменённые элементы

| Категория | Что сделано |
|---|---|
| **Metadata / title** | `src/app/layout.tsx` — title, description, Open Graph, themeColor |
| **Manifest / PWA** | `src/app/manifest.ts`, `public/sw.js`, PNG icons |
| **Favicon** | `src/app/icon.svg`, `branding.faviconPath` |
| **Login** | Заголовок Spiora + RU tagline из config |
| **Sidebar / Logo** | `Logo.tsx` → `branding.logoPath`, `productName` |
| **Dashboard** | «Spiora Workspace» |
| **Guest meetings** | Lobby/gate → `productName` |
| **PWA hint** | «Установите Spiora…» |
| **Tasks / Team chat** | Subtitle с `companyName` (demo tenant) |
| **AI prompts** | `workspace-prompt.ts`, `tone.ts`, `client-assistant.ts` |
| **OpenRouter title** | Default → `branding.openRouterAppTitle` |
| **LiveKit rooms** | `northstar-cal-*` → `spiora-cal-*` |
| **HTTP User-Agent** | `spiora-demo/1.0` |
| **Session cookie** | `ss_session` → `spiora_session` |
| **Package name** | `northstar-mobility-demo` → `spiora-demo` |
| **README** | Обновлён под Spiora |
| **CSS** | `.ss-body` → `.spiora-body` |

`src/lib/brand.ts` — тонкая обёртка над `@/config/branding` (обратная совместимость).

---

## Diff summary

```
40 файлов изменено: +143 / −156 строк
+ 5 новых файлов (config, manifest, SVG, test)
− 2 удалённых (logo.svg, manifest.json)
4 PWA PNG обновлены (бинарные)
```

---

## Поиск старого брендинга (после PR)

### `src/` — чисто для product branding

Остатки **допустимые**:

| Место | Почему OK |
|---|---|
| `branding.companyName` | Demo tenant, не продукт |
| `users.ts` comment | Demo company note |
| `meeting-guest-invite-message.test.ts` | Подпись «Команда Spiora» |
| `environment-guard.ts` | Blocklist production URL (не брендинг UI) |
| `CALENDAR_COMPANY_ID = northstar-mobility` | Demo data ID (не менялся) |

**Не найдено** в UI/metadata/manifest: `Sharp & Spice`, `Spiora` как название продукта.

### `public/` — чисто

- `public/manifest.json` удалён
- `public/logo.svg` удалён
- Активные assets: `spiora-logo.svg`, `spiora-mark.svg`, обновлённые PNG icons

### Вне scope PR (не трогали)

Исторические `*.md` (планы, аудиты) всё ещё содержат «Sharp & Spice» — это документация прошлых этапов, не runtime.

---

## Что осталось временно

1. **Spiora** — только как `companyName` (fictional demo tenant)
2. **Placeholder SVG-логотипы** — геометрический mark + текст; финальный brand design в будущем
3. **Двуязычные подписи** — только в `branding.ts`, без `next-intl`
4. **`company_id: northstar-mobility`** — demo data (PR #5)
5. **Cookie rename** — существующие сессии сбросятся после deploy

---

## Результаты тестов

```
npm test
ℹ tests 323
ℹ pass 323
ℹ fail 0
```

Новые тесты (`branding.test.ts`):
- metadata содержит Spiora
- manifest config содержит Spiora
- room prefix `spiora-cal`
- scan UI surfaces на legacy product names

---

## Результаты сборки

```
npm run build
✓ Compiled successfully
✓ Generating static pages (56/56)
○ /manifest.webmanifest
Exit code: 0
```

---

## Git status

```
Branch: main (без remote)
Modified: 40 files
Untracked: src/config/, src/app/manifest.ts, public/spiora-*.svg
Commit: не выполнен
```

---

## SAFE / NOT SAFE TO COMMIT

### ✅ SAFE TO COMMIT

- `src/config/**`
- `src/app/manifest.ts`, `layout.tsx`, `icon.svg`, `login/page.tsx`
- Все изменённые components/lib
- `public/spiora-*.svg`, `public/icons/*.png`, `public/sw.js`
- `scripts/generate-pwa-icons.mjs`
- `package.json`, `package-lock.json`, `README.md`
- `SPIORA_BRANDING_REPORT.md`

### ⛔ NOT SAFE TO COMMIT

- `.env.local` / `.env.development.local`
- Любые секреты и production credentials

---

## Рекомендуемый commit message (когда подтвердите)

```
Rebrand demo platform to Spiora with centralized branding config
```

---

## Следующий шаг

Подтвердить commit PR #2 → PR #3 (i18n architecture implementation).
