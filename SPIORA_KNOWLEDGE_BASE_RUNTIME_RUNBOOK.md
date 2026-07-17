# SPIORA — Knowledge Base Runtime Runbook

**PR #19.** Migration и seed **не применять** без отдельного подтверждения.

## Перед apply

1. Убедиться, что RLS Phase 1 (025) применён на demo Supabase.
2. Убедиться, что `is_spiora_owner()` и `spiora_block_hard_delete()` существуют (из 025).
3. Backup / snapshot проекта Supabase (Dashboard).

## Apply (только после подтверждения)

1. SQL Editor: выполнить `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql` (или `supabase/migrations/026_knowledge_base.sql`).
2. SQL Editor: выполнить `SPIORA_KNOWLEDGE_BASE_SEED_026.sql`.
3. Verification query:

```sql
select count(*) as articles from knowledge_base_articles where status = 'published';
-- expected: 15

select locale, count(*) from knowledge_base_article_translations group by locale;
-- expected: en=15, ru=15
```

## Vercel env (demo)

| Variable | Phase 1 (default) | After validation |
| --- | --- | --- |
| `SPIORA_KB_POSTGRES` | `true` (default) | `true` |
| `SPIORA_KB_EMBEDDED_FALLBACK` | `true` | **`false`** |

Пока `SPIORA_KB_EMBEDDED_FALLBACK=true`: при пустой/недоступной БД runtime использует встроенные i18n-статьи (без `.data/knowledge-base.json`).

После успешной runtime validation на Vercel:

1. Убедиться, что `GET /api/knowledge-base` возвращает `source: "postgresql"` и 15 статей.
2. Установить `SPIORA_KB_EMBEDDED_FALLBACK=false`.
3. Redeploy.
4. Повторить smoke: список, поиск, deep link, AI Workspace запрос с KB.

## Runtime checks (browser)

### Olivia (owner)

- `/knowledge-base` — 15 статей, RU/EN переключение.
- Поиск: `onboarding`, `эскалац`.
- Deep link: `/knowledge-base?article=working-with-ai-workspace`.
- AI Workspace: запрос про KB — контекст с PostgreSQL header.

### Daniel (manager)

- Список published статей — ✔
- Draft статьи — ✗ (не видны)
- POST/PATCH API — 403

### Anonymous

- `/api/knowledge-base` — 401
- Supabase direct SELECT — denied

## Rollback

При блокирующей регрессии:

1. `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE_ROLLBACK.sql`
2. `SPIORA_KB_EMBEDDED_FALLBACK=true` на Vercel
3. Redeploy — embedded fallback восстановит UI

## API reference (owner)

**Create:** `POST /api/knowledge-base`

```json
{
  "slug": "new-policy-draft",
  "categoryId": "company-policies",
  "tagKeys": ["compliance"],
  "authorKey": "olivia-bennett",
  "status": "draft",
  "translations": [
    { "locale": "en", "title": "...", "summary": "...", "content": "## ..." },
    { "locale": "ru", "title": "...", "summary": "...", "content": "## ..." }
  ]
}
```

**Publish:** `PATCH /api/knowledge-base/{slug}` — `{ "action": "publish" }`  
**Archive:** `PATCH /api/knowledge-base/{slug}` — `{ "action": "archive" }`
