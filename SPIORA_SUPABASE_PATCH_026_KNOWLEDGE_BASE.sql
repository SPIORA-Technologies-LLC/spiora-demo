-- =============================================================================
-- SPIORA_SUPABASE_PATCH_026_KNOWLEDGE_BASE.sql
-- PR #19 — Supabase Knowledge Base
-- Tables: knowledge_base_articles, knowledge_base_article_translations
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.
-- Apply seed separately: SPIORA_KNOWLEDGE_BASE_SEED_026.sql
-- =============================================================================

-- PR #19 — Supabase Knowledge Base
-- Tables: knowledge_base_articles, knowledge_base_article_translations
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.

-- =============================================================================
-- 1. Tables
-- =============================================================================

create table if not exists public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  category_id text not null,
  tag_keys text[] not null default array[]::text[],
  author_key text not null default '',
  status text not null default 'draft',
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  constraint knowledge_base_articles_slug_check
    check (length(trim(slug)) > 0),
  constraint knowledge_base_articles_category_check
    check (category_id in (
      'company-policies',
      'client-workflow',
      'document-management',
      'team-onboarding',
      'ai-automation'
    )),
  constraint knowledge_base_articles_status_check
    check (status in ('draft', 'published', 'archived'))
);

create unique index if not exists knowledge_base_articles_slug_uidx
  on public.knowledge_base_articles (slug);

create index if not exists knowledge_base_articles_status_idx
  on public.knowledge_base_articles (status)
  where archived_at is null;

create index if not exists knowledge_base_articles_category_idx
  on public.knowledge_base_articles (category_id)
  where status = 'published' and archived_at is null;

create index if not exists knowledge_base_articles_updated_idx
  on public.knowledge_base_articles (updated_at desc);

create table if not exists public.knowledge_base_article_translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_base_articles (id) on delete restrict,
  locale text not null,
  title text not null,
  summary text not null default '',
  content text not null default '',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_base_article_translations_locale_check
    check (locale in ('en', 'ru')),
  constraint knowledge_base_article_translations_title_nonempty
    check (length(trim(title)) > 0)
);

create unique index if not exists knowledge_base_article_translations_article_locale_uidx
  on public.knowledge_base_article_translations (article_id, locale);

create index if not exists knowledge_base_article_translations_search_idx
  on public.knowledge_base_article_translations using gin (search_vector);

comment on table public.knowledge_base_articles is
  'Knowledge Base articles. Slug preserved for deep links /knowledge-base?article=';

comment on table public.knowledge_base_article_translations is
  'Localized KB content (title, summary, markdown body).';

-- =============================================================================
-- 2. Search vector maintenance
-- =============================================================================

create or replace function public.knowledge_base_translations_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content, '')), 'C');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists knowledge_base_article_translations_search_vector
  on public.knowledge_base_article_translations;
create trigger knowledge_base_article_translations_search_vector
  before insert or update on public.knowledge_base_article_translations
  for each row
  execute function public.knowledge_base_translations_search_vector();

-- =============================================================================
-- 3. Helpers
-- =============================================================================

create or replace function public.is_spiora_kb_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and status = 'active'
      and archived_at is null
      and role in ('owner', 'manager', 'consultant', 'viewer')
  );
$$;

create or replace function public.kb_article_visible_to_reader(a public.knowledge_base_articles)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_spiora_kb_reader()
    and a.status = 'published'
    and a.archived_at is null;
$$;

revoke all on function public.is_spiora_kb_reader() from public;
grant execute on function public.is_spiora_kb_reader() to authenticated, service_role;

-- =============================================================================
-- 4. Hard delete guard
-- =============================================================================

drop trigger if exists knowledge_base_articles_block_hard_delete on public.knowledge_base_articles;
create trigger knowledge_base_articles_block_hard_delete
  before delete on public.knowledge_base_articles
  for each row
  execute function public.spiora_block_hard_delete();

drop trigger if exists knowledge_base_article_translations_block_hard_delete
  on public.knowledge_base_article_translations;
create trigger knowledge_base_article_translations_block_hard_delete
  before delete on public.knowledge_base_article_translations
  for each row
  execute function public.spiora_block_hard_delete();

-- =============================================================================
-- 5. Privileges
-- =============================================================================

revoke all on table public.knowledge_base_articles from anon, public;
revoke all on table public.knowledge_base_article_translations from anon, public;

grant select, insert, update on table public.knowledge_base_articles to authenticated;
grant select, insert, update on table public.knowledge_base_article_translations to authenticated;

revoke delete on table public.knowledge_base_articles from authenticated;
revoke delete on table public.knowledge_base_article_translations from authenticated;

-- =============================================================================
-- 6. RLS
-- =============================================================================

alter table public.knowledge_base_articles enable row level security;
alter table public.knowledge_base_article_translations enable row level security;

-- articles SELECT: owner sees all non-deleted; readers see published only
drop policy if exists rls_kb_articles_select_owner on public.knowledge_base_articles;
create policy rls_kb_articles_select_owner
  on public.knowledge_base_articles
  for select
  to authenticated
  using (public.is_spiora_owner());

drop policy if exists rls_kb_articles_select_published on public.knowledge_base_articles;
create policy rls_kb_articles_select_published
  on public.knowledge_base_articles
  for select
  to authenticated
  using (public.kb_article_visible_to_reader(knowledge_base_articles));

-- articles INSERT/UPDATE: owner only
drop policy if exists rls_kb_articles_insert_owner on public.knowledge_base_articles;
create policy rls_kb_articles_insert_owner
  on public.knowledge_base_articles
  for insert
  to authenticated
  with check (public.is_spiora_owner());

drop policy if exists rls_kb_articles_update_owner on public.knowledge_base_articles;
create policy rls_kb_articles_update_owner
  on public.knowledge_base_articles
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());

-- translations SELECT via parent article visibility
drop policy if exists rls_kb_translations_select on public.knowledge_base_article_translations;
create policy rls_kb_translations_select
  on public.knowledge_base_article_translations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_base_articles a
      where a.id = knowledge_base_article_translations.article_id
        and (
          public.is_spiora_owner()
          or public.kb_article_visible_to_reader(a)
        )
    )
  );

-- translations write: owner only; draft content owner-only via article policies
drop policy if exists rls_kb_translations_insert_owner on public.knowledge_base_article_translations;
create policy rls_kb_translations_insert_owner
  on public.knowledge_base_article_translations
  for insert
  to authenticated
  with check (public.is_spiora_owner());

drop policy if exists rls_kb_translations_update_owner on public.knowledge_base_article_translations;
create policy rls_kb_translations_update_owner
  on public.knowledge_base_article_translations
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());
