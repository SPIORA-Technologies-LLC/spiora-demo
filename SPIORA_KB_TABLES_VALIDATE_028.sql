-- =============================================================================
-- SPIORA_KB_TABLES_VALIDATE_028.sql
-- PR #21 — Post-apply validation for Knowledge Base Editable Tables migration 028
--
-- Run AFTER:
--   SPIORA_SUPABASE_PATCH_028_KNOWLEDGE_BASE_TABLES.sql
--   (or supabase/migrations/028_knowledge_base_tables.sql)
--
-- Read-only catalog / privilege checks. No DROP / DELETE of data.
-- Do NOT paste service-role keys into browser or logs.
-- Do NOT use SET ROLE / service_role to impersonate end users here.
-- Live owner/reader RLS behavior must be verified in the app (Olivia / Daniel).
--
-- FINAL_VERDICT:
--   VALIDATED_OK
--   VALIDATION_FAILED  (+ exact failed keys)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table exists + columns
-- -----------------------------------------------------------------------------
select
  'table_exists' as check_id,
  case
    when to_regclass('public.knowledge_base_tables') is null
      then 'FAIL: missing'
    else 'PASS'
  end as result;

select
  'table_columns_count_17' as check_id,
  case
    when (
      select count(*) = 17
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_base_tables'
        and column_name in (
          'id', 'article_id', 'title', 'description', 'schema_version',
          'columns', 'rows', 'row_count', 'column_count', 'sort_order',
          'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
          'archived_at', 'revision'
        )
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'column_types_core' as check_id,
  case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'id' and data_type = 'uuid' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'article_id' and data_type = 'uuid' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'title' and data_type = 'text' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'description' and data_type = 'text' and is_nullable = 'YES'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'columns' and data_type = 'jsonb' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'rows' and data_type = 'jsonb' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'revision' and data_type = 'integer' and is_nullable = 'NO'
        and column_default like '%1%'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'status' and data_type = 'text' and is_nullable = 'NO'
        and column_default ilike '%active%'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'schema_version' and data_type = 'integer' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'created_by' and data_type = 'text' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'updated_by' and data_type = 'text' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'created_at'
        and data_type = 'timestamp with time zone' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'updated_at'
        and data_type = 'timestamp with time zone' and is_nullable = 'NO'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'knowledge_base_tables'
        and column_name = 'archived_at'
        and data_type = 'timestamp with time zone' and is_nullable = 'YES'
    )
    then 'PASS'
    else 'FAIL: unexpected nullability/type/default on core columns'
  end as result;

-- -----------------------------------------------------------------------------
-- 2. FK to knowledge_base_articles
-- -----------------------------------------------------------------------------
select
  'fk_article_id' as check_id,
  case
    when exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.table_schema = 'public'
        and tc.table_name = 'knowledge_base_tables'
        and tc.constraint_type = 'FOREIGN KEY'
        and kcu.column_name = 'article_id'
        and ccu.table_name = 'knowledge_base_articles'
        and ccu.column_name = 'id'
    ) then 'PASS: article_id → knowledge_base_articles(id)'
    else 'FAIL: missing FK article_id → knowledge_base_articles'
  end as result;

-- -----------------------------------------------------------------------------
-- 3. CHECK constraints (status, limits, description, jsonb arrays, revision)
-- -----------------------------------------------------------------------------
select
  'check_constraints_inventory' as check_id,
  coalesce(
    (
      select string_agg(con.conname, ', ' order by con.conname)
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
    ),
    'FAIL: none'
  ) as result;

select
  'check_status' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_status_check'
        and pg_get_constraintdef(con.oid) ilike '%active%'
        and pg_get_constraintdef(con.oid) ilike '%archived%'
    ) then 'PASS'
    else 'FAIL: status CHECK missing/unexpected'
  end as result;

select
  'check_row_limit_1000' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_row_count_check'
        and pg_get_constraintdef(con.oid) like '%1000%'
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'check_column_limit_50' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_column_count_check'
        and pg_get_constraintdef(con.oid) like '%50%'
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'check_cell_limit_50000' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_cell_count_check'
        and pg_get_constraintdef(con.oid) like '%50000%'
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'check_description_2000' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_description_check'
        and pg_get_constraintdef(con.oid) like '%2000%'
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'check_title_200' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_title_check'
        and pg_get_constraintdef(con.oid) like '%200%'
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'check_jsonb_arrays' as check_id,
  case
    when (
      select count(*) = 2
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname in (
          'knowledge_base_tables_columns_is_array',
          'knowledge_base_tables_rows_is_array'
        )
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'check_revision_gte_1' as check_id,
  case
    when exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'knowledge_base_tables'
        and con.contype = 'c'
        and con.conname = 'knowledge_base_tables_revision_check'
    ) then 'PASS'
    else 'FAIL'
  end as result;

-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------
select
  'indexes_present' as check_id,
  case
    when (
      select count(*) = 3
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'knowledge_base_tables'
        and indexname in (
          'knowledge_base_tables_pkey',
          'knowledge_base_tables_article_idx',
          'knowledge_base_tables_article_status_idx'
        )
    ) then 'PASS: pkey + article_idx + article_status_idx'
    else 'FAIL: ' || coalesce(
      (
        select string_agg(indexname, ', ' order by indexname)
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'knowledge_base_tables'
      ),
      'none'
    )
  end as result;

-- -----------------------------------------------------------------------------
-- 5. Triggers: updated_at + hard-delete
-- -----------------------------------------------------------------------------
select
  'updated_at_trigger' as check_id,
  case
    when exists (
      select 1
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and c.relname = 'knowledge_base_tables'
        and tg.tgname = 'knowledge_base_tables_touch_updated_at'
    ) then 'PASS'
    else 'FAIL: missing'
  end as result;

select
  'updated_at_function' as check_id,
  case
    when to_regprocedure('public.knowledge_base_tables_touch_updated_at()') is not null
      then 'PASS'
    else 'FAIL: missing'
  end as result;

select
  'hard_delete_trigger' as check_id,
  case
    when exists (
      select 1
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not tg.tgisinternal
        and c.relname = 'knowledge_base_tables'
        and tg.tgname = 'knowledge_base_tables_block_hard_delete'
    ) then 'PASS'
    else 'FAIL: missing'
  end as result;

select
  'hard_delete_uses_spiora_block' as check_id,
  case
    when exists (
      select 1
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = tg.tgfoid
      where n.nspname = 'public'
        and not tg.tgisinternal
        and c.relname = 'knowledge_base_tables'
        and tg.tgname = 'knowledge_base_tables_block_hard_delete'
        and p.proname = 'spiora_block_hard_delete'
    ) then 'PASS'
    else 'FAIL'
  end as result;

-- -----------------------------------------------------------------------------
-- 6. Privileges: anon denied; authenticated no DELETE; has select/insert/update
-- -----------------------------------------------------------------------------
select
  'anon_table_privileges' as check_id,
  case
    when coalesce(
      (
        select string_agg(privilege_type, ',' order by privilege_type)
        from information_schema.role_table_grants
        where grantee = 'anon'
          and table_schema = 'public'
          and table_name = 'knowledge_base_tables'
      ),
      'none'
    ) = 'none' then 'PASS: none'
    else 'FAIL: ' || (
      select string_agg(privilege_type, ',' order by privilege_type)
      from information_schema.role_table_grants
      where grantee = 'anon'
        and table_schema = 'public'
        and table_name = 'knowledge_base_tables'
    )
  end as result;

select
  'authenticated_has_delete' as check_id,
  case
    when not exists (
      select 1
      from information_schema.role_table_grants
      where grantee = 'authenticated'
        and table_schema = 'public'
        and table_name = 'knowledge_base_tables'
        and privilege_type = 'DELETE'
    ) then 'PASS: no DELETE'
    else 'FAIL: DELETE granted'
  end as result;

select
  'authenticated_write_grants' as check_id,
  case
    when (
      select count(distinct privilege_type) = 3
      from information_schema.role_table_grants
      where grantee = 'authenticated'
        and table_schema = 'public'
        and table_name = 'knowledge_base_tables'
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE')
    ) then 'PASS: SELECT+INSERT+UPDATE'
    else 'FAIL: ' || coalesce(
      (
        select string_agg(privilege_type, ',' order by privilege_type)
        from information_schema.role_table_grants
        where grantee = 'authenticated'
          and table_schema = 'public'
          and table_name = 'knowledge_base_tables'
      ),
      'none'
    )
  end as result;

-- -----------------------------------------------------------------------------
-- 7. RLS + policies
-- -----------------------------------------------------------------------------
select
  'rls_tables' as check_id,
  case when c.relrowsecurity then 'PASS: enabled' else 'FAIL: disabled' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'knowledge_base_tables';

select
  'db_policies_present' as check_id,
  coalesce(string_agg(policyname, ', ' order by policyname), 'FAIL: missing') as result
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_tables'
  and policyname in (
    'rls_kb_tables_select_owner',
    'rls_kb_tables_select_published',
    'rls_kb_tables_insert_owner',
    'rls_kb_tables_update_owner'
  );

select
  'db_policies_count' as check_id,
  case when count(*) = 4 then 'PASS: 4' else 'FAIL: ' || count(*)::text end as result
from pg_policies
where schemaname = 'public'
  and tablename = 'knowledge_base_tables'
  and policyname in (
    'rls_kb_tables_select_owner',
    'rls_kb_tables_select_published',
    'rls_kb_tables_insert_owner',
    'rls_kb_tables_update_owner'
  );

select
  'owner_write_policies' as check_id,
  case when count(*) = 2 then 'PASS: insert+update owner' else 'FAIL' end as result
from pg_policies
where schemaname = 'public'
  and policyname in (
    'rls_kb_tables_insert_owner',
    'rls_kb_tables_update_owner'
  );

select
  'owner_select_policy' as check_id,
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and policyname = 'rls_kb_tables_select_owner'
        and cmd = 'SELECT'
        and roles::text ilike '%authenticated%'
        and qual::text ilike '%is_spiora_owner%'
    ) then 'PASS'
    else 'FAIL'
  end as result;

select
  'reader_policy_active_published_parent' as check_id,
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and policyname = 'rls_kb_tables_select_published'
        and cmd = 'SELECT'
        and roles::text ilike '%authenticated%'
        and qual::text ilike '%active%'
        and qual::text ilike '%archived_at%'
        and qual::text ilike '%kb_article_visible_to_reader%'
    ) then 'PASS — readers need active table + published (visible) parent'
    else 'FAIL: reader policy missing expected active/archived_at/kb_article_visible_to_reader guards'
  end as result;

select
  'no_anon_policies' as check_id,
  case
    when not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'knowledge_base_tables'
        and 'anon' = any (roles)
    ) then 'PASS: no anon policies'
    else 'FAIL: anon policy present'
  end as result;

select
  'no_delete_policy' as check_id,
  case
    when not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'knowledge_base_tables'
        and cmd = 'DELETE'
    ) then 'PASS: no DELETE policy'
    else 'FAIL'
  end as result;

-- Catalog-level notes for archived table / draft parent (runtime still required)
select
  'archived_table_hidden_catalog' as check_id,
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and policyname = 'rls_kb_tables_select_published'
        and qual::text ilike '%status%active%'
        and qual::text ilike '%archived_at%null%'
    ) then 'PASS (catalog): reader policy requires status=active and archived_at is null'
    else 'FAIL: reader policy does not clearly require active + archived_at is null'
  end as result;

select
  'draft_parent_hidden_catalog' as check_id,
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and policyname = 'rls_kb_tables_select_published'
        and qual::text ilike '%kb_article_visible_to_reader%'
    ) then 'PASS (catalog): reader path uses kb_article_visible_to_reader (draft parents excluded). Confirm live with Daniel.'
    else 'FAIL'
  end as result;

select
  'runtime_rls_note' as check_id,
  'INFO: Do not impersonate users via service_role in SQL Editor (bypasses RLS). Verify owner edit + Daniel read-only in the app after VALIDATED_OK.' as result;

-- -----------------------------------------------------------------------------
-- 8. FINAL VERDICT
-- -----------------------------------------------------------------------------
with checks as (
  select * from (
    values
      (
        'table',
        (to_regclass('public.knowledge_base_tables') is not null)
      ),
      (
        'columns',
        (
          select count(*) = 17
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'knowledge_base_tables'
            and column_name in (
              'id', 'article_id', 'title', 'description', 'schema_version',
              'columns', 'rows', 'row_count', 'column_count', 'sort_order',
              'status', 'created_by', 'updated_by', 'created_at', 'updated_at',
              'archived_at', 'revision'
            )
        )
      ),
      (
        'column_types',
        (
          exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'knowledge_base_tables'
              and column_name = 'columns' and data_type = 'jsonb' and is_nullable = 'NO'
          )
          and exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'knowledge_base_tables'
              and column_name = 'rows' and data_type = 'jsonb' and is_nullable = 'NO'
          )
          and exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'knowledge_base_tables'
              and column_name = 'revision' and data_type = 'integer' and is_nullable = 'NO'
          )
          and exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'knowledge_base_tables'
              and column_name = 'article_id' and data_type = 'uuid' and is_nullable = 'NO'
          )
        )
      ),
      (
        'fk_article',
        (
          exists (
            select 1
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on tc.constraint_name = kcu.constraint_name
             and tc.table_schema = kcu.table_schema
            join information_schema.constraint_column_usage ccu
              on ccu.constraint_name = tc.constraint_name
             and ccu.table_schema = tc.table_schema
            where tc.table_schema = 'public'
              and tc.table_name = 'knowledge_base_tables'
              and tc.constraint_type = 'FOREIGN KEY'
              and kcu.column_name = 'article_id'
              and ccu.table_name = 'knowledge_base_articles'
          )
        )
      ),
      (
        'check_status',
        (
          exists (
            select 1
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'knowledge_base_tables'
              and con.conname = 'knowledge_base_tables_status_check'
          )
        )
      ),
      (
        'check_row_1000',
        (
          exists (
            select 1
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'knowledge_base_tables'
              and con.conname = 'knowledge_base_tables_row_count_check'
              and pg_get_constraintdef(con.oid) like '%1000%'
          )
        )
      ),
      (
        'check_col_50',
        (
          exists (
            select 1
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'knowledge_base_tables'
              and con.conname = 'knowledge_base_tables_column_count_check'
              and pg_get_constraintdef(con.oid) like '%50%'
          )
        )
      ),
      (
        'check_cells_50000',
        (
          exists (
            select 1
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'knowledge_base_tables'
              and con.conname = 'knowledge_base_tables_cell_count_check'
              and pg_get_constraintdef(con.oid) like '%50000%'
          )
        )
      ),
      (
        'check_description_2000',
        (
          exists (
            select 1
            from pg_constraint con
            join pg_class c on c.oid = con.conrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relname = 'knowledge_base_tables'
              and con.conname = 'knowledge_base_tables_description_check'
              and pg_get_constraintdef(con.oid) like '%2000%'
          )
        )
      ),
      (
        'indexes',
        (
          select count(*) = 3
          from pg_indexes
          where schemaname = 'public'
            and tablename = 'knowledge_base_tables'
            and indexname in (
              'knowledge_base_tables_pkey',
              'knowledge_base_tables_article_idx',
              'knowledge_base_tables_article_status_idx'
            )
        )
      ),
      (
        'updated_at_trigger',
        (
          exists (
            select 1
            from pg_trigger tg
            join pg_class c on c.oid = tg.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and not tg.tgisinternal
              and c.relname = 'knowledge_base_tables'
              and tg.tgname = 'knowledge_base_tables_touch_updated_at'
          )
        )
      ),
      (
        'hard_delete_trigger',
        (
          exists (
            select 1
            from pg_trigger tg
            join pg_class c on c.oid = tg.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and not tg.tgisinternal
              and c.relname = 'knowledge_base_tables'
              and tg.tgname = 'knowledge_base_tables_block_hard_delete'
          )
        )
      ),
      (
        'rls',
        (
          select c.relrowsecurity
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'knowledge_base_tables'
        )
      ),
      (
        'policies',
        (
          select count(*) = 4
          from pg_policies
          where schemaname = 'public'
            and tablename = 'knowledge_base_tables'
            and policyname in (
              'rls_kb_tables_select_owner',
              'rls_kb_tables_select_published',
              'rls_kb_tables_insert_owner',
              'rls_kb_tables_update_owner'
            )
        )
      ),
      (
        'reader_policy',
        (
          exists (
            select 1 from pg_policies
            where schemaname = 'public'
              and policyname = 'rls_kb_tables_select_published'
              and qual::text ilike '%active%'
              and qual::text ilike '%kb_article_visible_to_reader%'
          )
        )
      ),
      (
        'anon_priv',
        (
          not exists (
            select 1
            from information_schema.role_table_grants
            where grantee = 'anon'
              and table_schema = 'public'
              and table_name = 'knowledge_base_tables'
          )
        )
      ),
      (
        'no_delete_grant',
        (
          not exists (
            select 1
            from information_schema.role_table_grants
            where grantee = 'authenticated'
              and table_schema = 'public'
              and table_name = 'knowledge_base_tables'
              and privilege_type = 'DELETE'
          )
        )
      ),
      (
        'no_anon_policy',
        (
          not exists (
            select 1 from pg_policies
            where schemaname = 'public'
              and tablename = 'knowledge_base_tables'
              and 'anon' = any (roles)
          )
        )
      )
  ) as t(check_key, ok)
),
failed as (
  select string_agg(check_key, ', ' order by check_key) as failed_keys
  from checks
  where not ok
)
select
  'FINAL_VERDICT' as check_id,
  case
    when (select failed_keys from failed) is null then 'VALIDATED_OK'
    else 'VALIDATION_FAILED'
  end as result,
  case
    when (select failed_keys from failed) is null
      then 'Schema + RLS posture OK for patch 028. Proceed to local runtime smoke (owner create/edit/paste/CSV/publish; Daniel read-only; archive; export).'
    else 'Failed: ' || (select failed_keys from failed)
  end as detail;

-- =============================================================================
-- PASS when FINAL_VERDICT = VALIDATED_OK, then runtime checklist in
-- SPIORA_KB_TABLES_CUTOVER_CHECKLIST_028.md
-- =============================================================================
