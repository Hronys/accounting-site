create table if not exists public.chat_conversations (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  company text not null check (char_length(company) between 1 and 160),
  bulstat text not null check (char_length(bulstat) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_role text not null check (sender_role in ('visitor', 'staff')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint chat_message_sender_matches_role check (
    (sender_role = 'visitor' and sender_id = conversation_id)
    or sender_role = 'staff'
  )
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at, id);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert on public.chat_conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;

create policy "Visitors create their own conversation"
  on public.chat_conversations for insert to authenticated
  with check (
    id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Visitors read their own conversation"
  on public.chat_conversations for select to authenticated
  using (
    id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Approved staff read conversations"
  on public.chat_conversations for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'chat_staff') = 'true');

create policy "Visitors read their own messages"
  on public.chat_messages for select to authenticated
  using (
    conversation_id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Approved staff read messages"
  on public.chat_messages for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'chat_staff') = 'true');

create policy "Visitors send messages to their own conversation"
  on public.chat_messages for insert to authenticated
  with check (
    conversation_id = (select auth.uid())
    and sender_id = (select auth.uid())
    and sender_role = 'visitor'
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
  );

create policy "Approved staff send replies"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_role = 'staff'
    and (select auth.jwt() -> 'app_metadata' ->> 'chat_staff') = 'true'
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;
