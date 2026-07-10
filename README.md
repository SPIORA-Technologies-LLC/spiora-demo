# Northstar Mobility Demo

Демонстрационная корпоративная платформа Northstar Mobility: AI Workspace, CRM, задачи, чат и аналитика.

> Это sanitized demo-копия. Не содержит production credentials и персональных данных.

## Локальный запуск

```bash
npm install
cp .env.example .env.local
# заполните AUTH_SECRET и AUTH_PASSWORD_* локально
npm run dev
```

## Демо-учётные записи

| Роль | Email |
|------|-------|
| Owner | `olivia@spiora.demo` |
| Manager | `daniel@spiora.demo`, `emma@spiora.demo`, `lucas@spiora.demo` |

Пароли задаются только в `.env.local` (`AUTH_PASSWORD_*`).

## PWA

Приложение можно установить как PWA с главной страницы входа. Иконки — нейтральные demo-assets.

## Тесты

```bash
npm test
npm run build
```
