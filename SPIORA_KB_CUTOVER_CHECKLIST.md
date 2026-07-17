# SPIORA — Knowledge Base Cutover Checklist (PR #19.3)

**Цель:** безопасный ручной cutover migration `026` + seed и runtime validation.  
**Запрещено на этом этапе:** push, deploy, изменение Vercel env, отключение embedded fallback, авто-apply migration.

**Требуемый HEAD:**
- `0fcab21` — Add Spiora demo production baseline checkpoint  
- `243d276` — Add Supabase-backed knowledge base with owner editor  

Проверка: `git log --oneline origin/main..HEAD` должен показывать оба коммита (или оба в истории).

**Артефакты SQL:**
| Файл | Когда |
| --- | --- |
| `SPIORA_KB_PREFLIGHT_026.sql` | до apply (read-only) |
| `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql` | apply schema |
| `SPIORA_KNOWLEDGE_BASE_SEED_026.sql` | apply seed |
| `SPIORA_KB_VALIDATE_026.sql` | после seed |
| `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE_ROLLBACK.sql` | только при регрессии |

**Env (не менять на Vercel сейчас):**
- `SPIORA_KB_EMBEDDED_FALLBACK` — **оставить `true` / default** (страховка)
- `SPIORA_KB_POSTGRES` — default `true` при включённом Supabase
- Service-role key — только server / SQL Editor; **не** в browser, **не** в логи чата

---

## Строгий порядок

### 1. Backup текущего Supabase demo

- [ ] Supabase Dashboard → Project Settings → Database → **Backup / snapshot** (или подтверждённый point-in-time recovery)
- [ ] Записать время backup: _______________

**Стоп, если backup недоступен.**

### 2. Read-only preflight

- [ ] SQL Editor → выполнить целиком `SPIORA_KB_PREFLIGHT_026.sql`
- [ ] Зафиксировать результаты (см. «Что прислать» ниже)

**Ожидания (минимум):**
- `spiora_rls_phase1_status` ≈ `enabled`
- `helper_is_spiora_owner` = ok
- `helper_block_hard_delete` = ok
- `active_owners` = `1`
- `profiles_without_auth_user` = `0`
- `invalid_roles` / `invalid_statuses` = `none`
- KB tables `absent` **или** `shape_ok` = ok
- `name_collision_tables` = `none`

**Стоп при любом FAIL → NOT SAFE TO APPLY.**

### 3. Apply migration / patch 026

- [ ] SQL Editor → `SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql`  
  (эквивалент: `supabase/migrations/026_knowledge_base.sql`)
- [ ] Убедиться, что выполнение без ошибок

### 4. Apply seed 026

- [ ] SQL Editor → `SPIORA_KNOWLEDGE_BASE_SEED_026.sql`
- [ ] Idempotent: повторный запуск не должен плодить дубликаты

### 5. SQL validation

- [ ] SQL Editor → `SPIORA_KB_VALIDATE_026.sql`
- [ ] `articles_total` = 15, `translations_total` = 30, `unique_slugs` = 15
- [ ] `missing_locale_pairs` = none, empty content = 0
- [ ] RLS enabled, 7 policies, hard-delete triggers, anon privileges = none

**Стоп при FAIL → rollback только при блокирующей регрессии (`…_ROLLBACK.sql`).**

### 6. Локальный runtime validation

**Не печатать secrets. Не менять Vercel.**

```bat
cd /d "c:\Users\Nika\Desktop\spiora demo"
npm.cmd run dev
```

В отдельном терминале (после login cookie / через браузер DevTools Network удобнее):

1. Открыть `http://localhost:3000/login` → Olivia (owner)
2. Network → `GET /api/knowledge-base`
3. Проверить JSON:
   - `"source": "postgresql"`
   - `"articles"` length ≥ 15 (published)
   - `"canManage": true` (owner)
4. Подтвердить, что **fallback не отключён** (env локально: `SPIORA_KB_EMBEDDED_FALLBACK` не `false`)
5. Owner → `GET /api/system/health` — `postgresql` / `rls` без ошибок (не логировать ключи)

Ожидание после seed: **source = postgresql**, страховка fallback **включена**.

### 7. Owner UI E2E (Olivia)

- [ ] Открыть `/knowledge-base`
- [ ] Видны owner controls: **Новая статья**, Edit / Duplicate / Publish / Archive
- [ ] **Создать draft** (`/knowledge-base/new`)
- [ ] Заполнить **RU и EN** (title, summary, markdown)
- [ ] **Сохранить черновик**
- [ ] Повторно открыть `/knowledge-base/edit/<slug>`
- [ ] Изменить текст RU и EN
- [ ] **Preview** (переключение locale)
- [ ] **Publish**
- [ ] Deep link `/knowledge-base?article=<slug>` открывает статью
- [ ] Search / category / tag работают
- [ ] **Archive** → статья исчезает из обычного списка; видна в фильтре «Архив»

### 8. Daniel read-only E2E (manager)

- [ ] Logout → login Daniel
- [ ] Видит **опубликованную** статью Olivia
- [ ] **Не** видит draft
- [ ] **Не** видит archive в обычном списке
- [ ] **Не** видит owner controls (Новая / Edit / Publish / Archive)
- [ ] Прямой URL `/knowledge-base/new` → redirect на `/knowledge-base`
- [ ] Прямой URL `/knowledge-base/edit/<slug>` → redirect
- [ ] `POST /api/knowledge-base` → **403** (DevTools / curl с session cookie)

### 9. AI Workspace validation

- [ ] После **publish** новая статья попадает в KB context AI Workspace (запрос по ключевым словам title)
- [ ] **Draft** и **archived** не попадают в AI context для manager (и не в published listing)
- [ ] Источник KB для AI — PostgreSQL path (header / содержимое из DB, не Google Drive)
- [ ] Demo **AI draft** в редакторе (`🤖 Создать с помощью AI`) работает **без** external AI API

### 10. Только после этого — push / deploy

- [ ] Все шаги 1–9 PASS
- [ ] Обновить `SPIORA_KNOWLEDGE_BASE_RUNTIME_VALIDATION.md` с вашими результатами
- [ ] Получить вердикты: SAFE TO PUSH / DEPLOY
- [ ] **Отдельный** шаг позже: отключить fallback на Vercel (`SPIORA_KB_EMBEDDED_FALLBACK=false`) — **не в том же деплое**, что первый cutover

---

## Что прислать после ручной проверки

1. **Preflight** — скрин или таблица `check_id` / `result` (без secrets)  
2. **Validate** — `articles_total`, `translations_total`, `missing_locale_pairs`, `kb_policies_count`, `anon_table_privileges`  
3. **Runtime** — фрагмент JSON `GET /api/knowledge-base`: `source`, `canManage`, число `articles` (без cookies/tokens)  
4. **Olivia E2E** — PASS/FAIL по пунктам §7  
5. **Daniel E2E** — PASS/FAIL по пунктам §8  
6. **AI Workspace** — PASS/FAIL по пунктам §9  
7. Подтверждение: **fallback всё ещё включён**

После этого агент обновит `SPIORA_KNOWLEDGE_BASE_RUNTIME_VALIDATION.md` и выставит:

- SAFE / NOT SAFE TO PUSH  
- SAFE / NOT SAFE TO DEPLOY  
- SAFE / NOT SAFE TO DISABLE FALLBACK  

---

## Напоминание по fallback

Не выключать embedded fallback в момент первого apply.  
Сначала production/demo с `source: "postgresql"` + страховка → отдельное маленькое изменение env.
