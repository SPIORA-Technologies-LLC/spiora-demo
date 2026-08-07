# Changelog

## Phase C — Employee MFA

Реализовано:

- TOTP MFA для сотрудников
- MFA Challenge после успешного логина
- Recovery Codes
- Re-enroll после восстановления
- Middleware enforcement
- API enforcement
- Google OAuth интеграция с MFA
- Password login интеграция с MFA
- Security audit событий MFA
- Recovery flow с удалением старого фактора
- Защита employee API при AAL1

Функциональность включается флагом:

```text
SPIORA_MFA_EMPLOYEE=true
```
