-- KB file-panel links (URL bookmarks on an article)
-- Idempotent. Non-destructive. No secrets. Do NOT auto-apply.
-- Requires 026 (articles).

create table if not exists public.knowledge_base_links (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null
    references public.knowledge_base_articles (id) on delete restrict,
  url text not null,
  label text,
  sort_order integer not null default 0,
  status text not null default 'active',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint knowledge_base_links_url_check
    check (
      length(trim(url)) > 0
      and length(url) <= 2000
      and url ~* '^https?://'
    ),
  constraint knowledge_base_links_label_check
    check (label is null or length(label) <= 200),
  constraint knowledge_base_links_status_check
    check (status in ('active', 'archived'))
);

create index if not exists knowledge_base_links_article_idx
  on public.knowledge_base_links (article_id, sort_order, created_at)
  where status = 'active' and archived_at is null;

create index if not exists knowledge_base_links_article_status_idx
  on public.knowledge_base_links (article_id, status);

comment on table public.knowledge_base_links is
  'External http(s) bookmarks attached to a KB article (Files panel).';

drop trigger if exists knowledge_base_links_block_hard_delete
  on public.knowledge_base_links;
create trigger knowledge_base_links_block_hard_delete
  before delete on public.knowledge_base_links
  for each row
  execute function public.spiora_block_hard_delete();

revoke all on table public.knowledge_base_links from anon, public;
grant select, insert, update on table public.knowledge_base_links to authenticated;
revoke delete on table public.knowledge_base_links from authenticated;

alter table public.knowledge_base_links enable row level security;

drop policy if exists rls_kb_links_select_owner on public.knowledge_base_links;
create policy rls_kb_links_select_owner
  on public.knowledge_base_links
  for select
  to authenticated
  using (public.is_spiora_owner());

drop policy if exists rls_kb_links_select_published on public.knowledge_base_links;
create policy rls_kb_links_select_published
  on public.knowledge_base_links
  for select
  to authenticated
  using (
    status = 'active'
    and archived_at is null
    and exists (
      select 1
      from public.knowledge_base_articles a
      where a.id = knowledge_base_links.article_id
        and public.kb_article_visible_to_reader(a)
    )
  );

drop policy if exists rls_kb_links_insert_owner on public.knowledge_base_links;
create policy rls_kb_links_insert_owner
  on public.knowledge_base_links
  for insert
  to authenticated
  with check (public.is_spiora_owner());

drop policy if exists rls_kb_links_update_owner on public.knowledge_base_links;
create policy rls_kb_links_update_owner
  on public.knowledge_base_links
  for update
  to authenticated
  using (public.is_spiora_owner())
  with check (public.is_spiora_owner());
