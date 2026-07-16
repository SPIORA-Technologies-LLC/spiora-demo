# SPIORA — Auth Cutover Plan

## Принцип

Параллельный контур → validation → cutover → удаление legacy.  
Никаких silent fallback.

## Фазы

### Phase 1 (этот PR)

- таблица `user_profiles`
- Auth clients boundaries
- provider switch
- parallel login
- health/probes
- runbook

Legacy остаётся для local.

### Phase 2 — Validation

- создать Auth users вручную
- заполнить profiles
- локально `SPIORA_AUTH_PROVIDER=supabase`
- прогнать owner/manager/logout/suspended/expired

### Phase 3 — Staging / Vercel preview

- только supabase provider
- проверить cookie refresh
- проверить rate-limit table на multi-instance

### Phase 4 — Production cutover

- включить supabase на production
- мониторить login failures / health
- держать rollback plan: preview rollback deployment (не «включить legacy на prod»)

### Phase 5 — Decommission legacy

- удалить DEV passwords из `users.ts` как login source
- убрать JWT cookie path
- перевести roster (`listTeamUsers`) на `user_profiles`
- включить RLS

## Rollback rules

| Среда | Rollback |
|---|---|
| Local | `SPIORA_AUTH_PROVIDER=legacy` |
| Production | redeploy предыдущей версии / feature flag только если заранее подготовлен; **не** silent fallback на passwords из кода |

## Definition of Done для cutover

- [ ] owner/manager login через Supabase Auth
- [ ] роль только из `user_profiles`
- [ ] suspended/archived блокируются
- [ ] health без секретов
- [ ] нет паролей в Git
- [ ] legacy отключён в production
