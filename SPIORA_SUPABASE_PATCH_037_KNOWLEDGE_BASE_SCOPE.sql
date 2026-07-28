begin;

alter table public.knowledge_base_articles
  add column if not exists scope text;

update public.knowledge_base_articles
set scope = 'corporate'
where scope is null;

alter table public.knowledge_base_articles
  alter column scope set default 'corporate';

alter table public.knowledge_base_articles
  alter column scope set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_base_articles_scope_check'
  ) then
    alter table public.knowledge_base_articles
      add constraint knowledge_base_articles_scope_check
      check (scope in ('corporate', 'client'));
  end if;
end $$;

create index if not exists knowledge_base_articles_scope_status_idx
  on public.knowledge_base_articles (scope, status, updated_at desc);

create index if not exists knowledge_base_articles_scope_category_idx
  on public.knowledge_base_articles (scope, category_id, updated_at desc);

commit;
