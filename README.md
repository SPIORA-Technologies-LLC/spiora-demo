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

# Employee Multi-Factor Authentication (MFA)

## Назначение

- MFA защищает **employee**-аккаунты.
- Используется **TOTP** (Google Authenticator, Microsoft Authenticator, 2FAS и т.д.).
- Для **client-портала** MFA сейчас не применяется.

## Как включить MFA

1. Войти в employee-аккаунт.
2. Settings → Security.
3. Открыть «Мой MFA (Аутентификатор)».
4. Нажать «Включить MFA».
5. Отсканировать QR-код.
6. Ввести 6-значный код.
7. Сохранить recovery codes в безопасном месте.

**Важно:** recovery codes показываются только один раз.

Функциональность включается флагом `SPIORA_MFA_EMPLOYEE=true` (по умолчанию выключена).

## Повседневный вход

После успешного логина:

```text
Пароль
или
Google OAuth
    ↓
MFA Challenge
    ↓
6-значный код
    ↓
Dashboard
```

Если MFA у пользователя не включена — второй фактор не требуется.

## Recovery Codes

- Выдаются при первом включении MFA.
- Одноразовые: каждый код можно использовать только один раз.
- Рекомендуется хранить офлайн.
- После перевыпуска старые коды становятся недействительными.

## Потеря телефона

Если пользователь потерял устройство:

1. Использовать recovery code.
2. Войти в систему.
3. Старый TOTP автоматически удаляется.
4. Выполняется re-enroll.
5. Пользователь получает новый QR и новые recovery codes.

## Re-enroll

После восстановления через recovery code:

- старый фактор удаляется;
- старые recovery codes недействительны;
- необходимо снова включить MFA;
- выдаются новые recovery codes.

## Администрирование

Что может сделать администратор:

- потребовать повторную настройку MFA;
- проверить, включена ли MFA;
- помочь пользователю пройти повторную регистрацию.

Что администратор **не** может:

- посмотреть TOTP secret;
- посмотреть recovery codes;
- восстановить использованный recovery code;
- получить доступ к кодам пользователя.

## Security Notes

- Хранить recovery codes офлайн.
- Не делать скриншоты QR-кода.
- Не передавать recovery codes другим людям.
- Использовать отдельное приложение-аутентификатор.
