# Spiora Client Invitations — Runtime Checklist (PR #30)

Do **not** apply migration until this checklist is ready to run on a target environment.

## Pre-flight

- [ ] Review `032_spiora_client_invitations.sql` + rollback  
- [ ] Confirm Supabase Auth enabled (portal needs Auth; legacy JWT alone is insufficient for clients)  
- [ ] Confirm `SPIORA_AUTH_PROVIDER=supabase` for portal demos  
- [ ] Note: without migration applied, Postgres path fails; local `.data` fallback works only when Supabase admin is **not** configured  

## Employee flow

- [ ] Sign in as owner/manager  
- [ ] Open **Clients** → **Invite client**  
- [ ] Select **assigned employee** (required)
- [ ] Select service type and questionnaire language  
- [ ] Confirm list shows pending row **without** token/hash  
- [ ] Confirm reload cannot restore plaintext URL  
- [ ] Revoke pending invitation → state revoked  
- [ ] Create again for same email → new pending invite allowed  

## Client flow (incognito)

- [ ] Open invite URL  
- [ ] Valid screen shows masked email + expiry  
- [ ] Register with **matching** email → accept → land on `/client`  
- [ ] See Spiora Client shell + “Invitation accepted”  
- [ ] Visit `/dashboard` / `/clients` → redirected to employee login (no access)  
- [ ] Logout → `/client/login` → login again → `/client`  

## Negative cases

- [ ] Expired invite → expired UI / API 410  
- [ ] Revoked invite → revoked UI  
- [ ] Reuse invite with another account → denied  
- [ ] Accept with mismatched email → `EMAIL_MISMATCH`  
- [ ] Create invitation → see one-time URL → **Copy link**
- [ ] With `SPIORA_DEMO_MODE=true`: register client without opening mailbox  
- [ ] Invalid token → neutral unavailable message  

## Security spot checks

- [ ] Network responses never include `token_hash`  
- [ ] Server logs do not print invite tokens  
- [ ] Invite page response has `Cache-Control: no-store` / `Referrer-Policy: no-referrer`  
- [ ] Employee session cannot open `/client` shell  

## After manual apply (later)

- [ ] Apply 032 on staging  
- [ ] Re-run checklist against Postgres path (not `.data`)  
- [ ] Keep rollback script ready  
