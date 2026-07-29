create table if not exists public.client_portal_ai_chats (
  id text primary key,
  portal_user_id text not null,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_portal_ai_chats_user_updated_idx
  on public.client_portal_ai_chats (portal_user_id, updated_at desc);
