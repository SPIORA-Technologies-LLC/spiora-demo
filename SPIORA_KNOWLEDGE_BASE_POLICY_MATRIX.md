# SPIORA — Knowledge Base Policy Matrix

**PR #19.** Источник идентичности: `auth.uid()` → `user_profiles` → `role` / `status`.  
Активный пользователь: `status = 'active'` AND `archived_at IS NULL`.

## Helper functions

| Функция | Возврат | Примечания |
| --- | --- | --- |
| `is_spiora_kb_reader()` | boolean | owner, manager, consultant, viewer (active) |
| `kb_article_visible_to_reader(article)` | boolean | reader + `status = published` + not archived |

## knowledge_base_articles

| Операция | Owner | Manager / Consultant / Viewer | Anonymous |
| --- | --- | --- | --- |
| SELECT published | ✔ | ✔ | ✗ |
| SELECT draft | ✔ | ✗ | ✗ |
| SELECT archived | ✔ (row exists) | ✗ | ✗ |
| INSERT | ✔ | ✗ | ✗ |
| UPDATE (edit, publish, archive) | ✔ | ✗ | ✗ |
| Hard DELETE | ✗ (trigger + no DELETE grant) | ✗ | ✗ |

**Archive:** `status = 'archived'`, `archived_at` set — не hard delete.

## knowledge_base_article_translations

| Операция | Owner | Readers | Anonymous |
| --- | --- | --- | --- |
| SELECT | ✔ если видит parent article | ✔ только published parent | ✗ |
| INSERT / UPDATE | ✔ | ✗ | ✗ |
| Hard DELETE | ✗ | ✗ | ✗ |

## App-layer RBAC (Next.js API)

| Endpoint | Owner | Manager+ | Notes |
| --- | --- | --- | --- |
| `GET /api/knowledge-base` | ✔ | ✔ | Postgres + fallback |
| `POST /api/knowledge-base` | ✔ | ✗ | create article |
| `GET /api/knowledge-base/[slug]` | ✔ | ✔ | published via RLS when using user JWT |
| `PATCH /api/knowledge-base/[slug]` | ✔ | ✗ | update / publish / archive |

Server repository uses **service_role** (Variant B, как CRM). RLS защищает прямой Supabase Data API с user JWT.

## Теги

Хранятся как `tag_keys text[]` на `knowledge_base_articles`. Отдельная таблица тегов не требуется на Phase 1.
