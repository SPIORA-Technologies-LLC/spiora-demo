# Spiora Demo

Демонстрационная корпоративная платформа **Spiora**: AI Workspace, CRM, задачи, чат и аналитика.

> Sanitized demo-копия. Не содержит production credentials и персональных данных.

## Локальный запуск

```bash
npm install
cp .env.spiora.example .env.local
# заполните AUTH_SECRET и AUTH_PASSWORD_* локально
npm run dev
```

Подробнее: `SPIORA_LOCAL_ENV_SETUP.md`

## Демо-учётные записи

| Роль | Email |
|------|-------|
| Owner | `olivia@spiora.demo` |
| Manager | `daniel@spiora.demo`, `emma@spiora.demo`, `lucas@spiora.demo` |

Пароли задаются только в `.env.local` (`AUTH_PASSWORD_*`).

## PWA

Приложение можно установить как PWA со страницы входа. Иконки генерируются из `public/icon1.jpg`:

```bash
npm run pwa:icons
```

## Тесты

```bash
npm test
npm run build
```
