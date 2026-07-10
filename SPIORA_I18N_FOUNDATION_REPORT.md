# Spiora — отчёт PR #3A: I18n Foundation

**Дата:** 10 июля 2026  
**Статус:** реализация завершена, commit **не выполнен** (ожидает подтверждения)

---

## Цель

Создать фундамент локализации Spiora с English по умолчанию, Russian как вторым языком, cookie-based переключением без URL-префиксов и централизованными словарями.

---

## Выбранная архитектура

| Решение | Значение |
|---|---|
| Библиотека | **next-intl v4** (совместим с Next.js 15 App Router) |
| URL-модель | `localePrefix: "never"` — без `/en` и `/ru` |
| Хранение locale | Cookie `SPIORA_LOCALE` (1 год) |
| Default locale | `en` |
| Fallback | `en` + `getMessageFallback()` |
| Словари | `src/i18n/dictionaries/en.json`, `ru.json` |
| Форматирование | `src/i18n/format.ts` (`Intl.*`) |

### Поток запроса

```
Browser cookie SPIORA_LOCALE
        │
        ▼
middleware.ts (next-intl + auth)
        │
        ▼
src/i18n/request.ts (cookie + requestLocale → locale)
        │
        ▼
NextIntlClientProvider (layout.tsx)
        │
        ▼
useTranslations() / getTranslations()
```

Переключение языка: `POST /api/locale` → cookie → `router.replace(same path + query)` → `router.refresh()` (сессия и форма сохраняются).

---

## Структура файлов

```text
src/i18n/
  config.ts           # locales, cookie, routing (defineRouting)
  request.ts          # next-intl server config
  navigation.ts       # createNavigation (без URL prefix)
  locale.ts           # resolveLocaleFromSources()
  messages.ts         # загрузка словарей + fallback merge
  format.ts           # даты, числа, дни/месяцы
  dictionaries/
    en.json
    ru.json
  i18n.test.ts

src/components/i18n/
  LanguageSwitcher.tsx
  LanguageSwitcher.module.css

src/app/api/locale/route.ts
```

---

## Пример структуры словарей

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "clients": "Clients",
    "tasks": "Tasks",
    "logout": "Logout"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading"
  },
  "states": {
    "noData": "No data",
    "error": "Something went wrong"
  },
  "auth": {
    "email": "Email",
    "password": "Password",
    "signIn": "Sign in",
    "invalidCredentials": "Invalid email or password."
  }
}
```

Русский словарь (`ru.json`) переопределяет те же ключи; отсутствующие ключи fallback → English.

---

## Переведённые shared-компоненты

| Компонент | Что локализовано |
|---|---|
| `src/app/layout.tsx` | `<html lang>`, metadata description, `NextIntlClientProvider` |
| `src/app/manifest.ts` | PWA description по locale |
| `src/app/login/page.tsx` | Tagline, LanguageSwitcher |
| `src/components/auth/LoginForm.tsx` | Labels, кнопки, ошибки (через server action) |
| `src/components/auth/DemoCredentials.tsx` | Demo environment shell |
| `src/app/login/actions.ts` | Auth error messages |
| `src/components/layout/AppShell.tsx` | Role labels |
| `src/components/layout/Sidebar.tsx` | Shared nav keys, aria-label |
| `src/components/layout/TopbarClient.tsx` | Search, logout, LanguageSwitcher |
| `src/components/notifications/NotificationBell.tsx` | Panel shell (title, empty, loading, actions) |
| `src/lib/auth/permissions.ts` | Shared nav `labelKey` (dashboard, clients, tasks, …) |

### LanguageSwitcher размещение

- Login page (верх карточки)
- Desktop header (`TopbarClient`)
- Mobile sidebar footer (`Sidebar`, `@media max-width: 900px`)

---

## Не переведено в этом PR (намеренно)

- CRM, Client Card, Tasks module content
- Calendar module content
- Team Chat messages/UI body
- AI Workspace
- Knowledge Base
- Analytics
- Team management pages
- API error messages модулей
- Notification type labels / content (только shell)
- Module-specific nav: «Новые лиды», «Эмиграция», «Записи встреч», …

---

## Дополнительные исправления

- `middleware.ts`: cookie сессии `ss_session` → `spiora_session` (согласовано с PR #2)
- `branding.defaultLocale` → `en`

---

## Риски

| Риск | Митигация |
|---|---|
| Смешанный EN/RU UI до следующих PR | Shared shell переведён; модули — в отдельных PR |
| Cookie vs Accept-Language | Cookie `SPIORA_LOCALE` имеет приоритет в `request.ts` |
| Missing keys в ru | Fallback на `en.json` + dev warning |
| Server actions + locale | `getTranslations()` в `signInAction` читает cookie |
| Рост bundle next-intl | Только shared keys (~80 строк на язык) |

---

## План следующего этапа (PR #3B+)

1. **PR #3B** — Dashboard + Settings shared strings
2. **PR #3C** — Tasks module
3. **PR #3D** — Calendar module
4. **PR #3E** — Clients / CRM
5. **PR #3F** — Team Chat + Notifications content
6. **PR #3G** — AI Workspace prompts/UI split (отдельная стратегия для AI)

---

## Результаты тестов

```
npm test
ℹ tests 337
ℹ pass 337
ℹ fail 0
```

Новые тесты (`src/i18n/i18n.test.ts`):
- English по умолчанию
- Переключение на `ru`
- Cookie restore / `SPIORA_LOCALE`
- Fallback на English
- Shared navigation translations
- Форматирование дат/чисел en vs ru
- `html lang` en/ru
- Сохранение route + query

---

## Результаты сборки

```
npm run build
✓ Compiled successfully
✓ Generating static pages (57/57)
Exit code: 0
```

---

## Smoke test (локально)

| Сценарий | Результат |
|---|---|
| `/login` без cookie → `lang="en"` | ✅ |
| `POST /api/locale {ru}` + `/login` → `lang="ru"`, label «Пароль» | ✅ |
| `/login?next=/tasks?...` → hidden `next` сохранён | ✅ |
| Locale API → `{"ok":true,"locale":"ru"}` | ✅ |

---

## Diff summary

```
18 изменённых файлов: +1009 / −108
+ новые: src/i18n/** (9 файлов), src/components/i18n/**, src/app/api/locale/
+ dependency: next-intl
```

---

## Git status

```
Branch: main (без remote)
Modified: 18 files
Untracked: src/i18n/, src/components/i18n/, src/app/api/locale/
Commit: не выполнен
```

---

## SAFE / NOT SAFE TO COMMIT

### ✅ SAFE TO COMMIT

- `src/i18n/**`
- `src/components/i18n/**`
- `src/app/api/locale/route.ts`
- Изменения layout, login, shell, manifest, middleware, next.config
- `package.json`, `package-lock.json`
- `SPIORA_I18N_FOUNDATION_REPORT.md`

### ⛔ NOT SAFE TO COMMIT

- `.env.local` / `.env.development.local`
- Любые секреты и production credentials

---

## Рекомендуемый commit message (когда подтвердите)

```
Add Spiora i18n foundation with next-intl and cookie-based locale switching
```
