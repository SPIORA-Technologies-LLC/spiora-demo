# PR #20.1 — Knowledge Base Attachments Cutover Checklist

Manual cutover only. **Do not** auto-apply migration, auto-create bucket from CI, push, or deploy until the steps below pass.

## Bucket facts (Phase 1)

| Item | Value |
|------|--------|
| Bucket name / id | `knowledge-base` |
| Public? | **No** (`public = false`) |
| Created by | **Yes — patch/migration 027 via SQL** (`insert into storage.buckets … on conflict do update`) |
| Dashboard create required? | **No**, if SQL apply succeeds. Use Dashboard only if SQL insert fails or to visually confirm `Private`. |
| MIME allowlist (Storage) | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` |
| Storage `file_size_limit` | `26214400` (25 MiB) — covers PDF max; app also caps images at 10 MiB |
| App PDF max | 25 MiB |
| App image max | 10 MiB |
| Max attachments / article | 10 (app-enforced) |
| Storage object policies | **None** in Phase 1 (same pattern as `task-attachments`). Binaries via Next.js proxy + `service_role`. |
| Permanent public URLs | **Forbidden** |

SQL source of truth:

- `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql`
- `supabase/migrations/027_knowledge_base_attachments.sql` (same content)

Rollback (destructive): `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS_ROLLBACK.sql`

---

## Exact manual order

### 1. Backup
- [ ] Supabase project backup / snapshot (or confirmed PITR) **before** any DDL
- [ ] Confirm you can restore if cutover fails

### 2. Preflight (read-only)
- [ ] Open Supabase SQL Editor
- [ ] Run `SPIORA_KB_ATTACHMENTS_PREFLIGHT_027.sql`
- [ ] Confirm `FINAL_VERDICT` = **`READY_TO_APPLY`**
- [ ] If `NOT_READY` → fix failed `check_id`s; **do not apply 027**

### 3. Apply patch 027
- [ ] Paste/run `SPIORA_SUPABASE_PATCH_027_KNOWLEDGE_BASE_ATTACHMENTS.sql` in SQL Editor
- [ ] Expect: table + RLS + trigger + **private bucket upsert**
- [ ] Do **not** change Vercel env (existing `SUPABASE_SERVICE_ROLE_KEY` is enough)

### 4. Verify / create private bucket
- [ ] Prefer SQL result from step 3 (bucket created/updated automatically)
- [ ] Dashboard → Storage → confirm bucket **`knowledge-base`** exists and is **Private**
- [ ] Confirm MIME allowlist + 25 MiB limit (or re-run patch upsert)
- [ ] Only if SQL bucket insert failed: create **Private** bucket named exactly `knowledge-base` with the MIME/size limits above — then re-check with validate

### 5. Validation (post-apply)
- [ ] Run `SPIORA_KB_ATTACHMENTS_VALIDATE_027.sql`
- [ ] Confirm `FINAL_VERDICT` = **`VALIDATED_OK`**
- [ ] Confirm: RLS on, 4 DB policies, hard-delete trigger, anon denied, bucket private, no client Storage policies

### 6. Local runtime — owner upload PDF
- [ ] Local app with Postgres KB enabled + owner session (Olivia)
- [ ] Create/open text draft → **Вложения** → upload PDF ≤ 25 MiB
- [ ] Preview / download via app proxy (no permanent Storage URL in browser)

### 7. Local runtime — owner upload image
- [ ] Upload PNG or JPEG or WebP ≤ 10 MiB
- [ ] Image preview works; SVG / exe rejected

### 8. Daniel (manager) read-only
- [ ] As Daniel: **cannot** upload / archive (API 403 / no controls)
- [ ] Published article: can see/download **active** attachments
- [ ] Draft article: attachments **hidden**

### 9. Archive attachment
- [ ] As owner: archive attachment → disappears for Daniel
- [ ] Confirm hard DELETE is not used / blocked

### 10. Only then push / deploy
- [ ] Push commit(s) containing app + SQL files (when operator approves)
- [ ] Deploy app after DB cutover is validated
- [ ] Smoke on deployed env (same checks as 6–9)
- [ ] Still do **not** paste service-role into browser / client logs

---

## Stop conditions

| Gate | Proceed only if |
|------|-----------------|
| Preflight | `READY_TO_APPLY` |
| Apply | SQL completed without error |
| Validate | `VALIDATED_OK` |
| Runtime | Owner PDF + image OK; Daniel read-only OK; archive hides attachment |
| Push/deploy | All above green **and** explicit operator approval |

## Explicitly out of scope for this cutover script pack

- Auto-apply migration
- Auto push / deploy
- Vercel env changes
- DOCX / CSV / video / OCR / AI file indexing
