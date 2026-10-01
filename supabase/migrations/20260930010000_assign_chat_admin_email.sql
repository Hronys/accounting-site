-- Allow the confirmed owner email to access the staff inbox and send replies.
-- Email magic-link sign-in verifies mailbox ownership before a session is issued.
drop policy if exists "Approved staff read conversations" on public.chat_conversations;
drop policy if exists "Approved staff read messages" on public.chat_messages;
drop policy if exists "Approved staff send replies" on public.chat_messages;

create policy "Chat admin reads conversations"
  on public.chat_conversations for select to authenticated
  using (
    lower((select auth.jwt() ->> 'email')) = 'nikolayivanovhome@gmail.com'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  );

create policy "Chat admin reads messages"
  on public.chat_messages for select to authenticated
  using (
    lower((select auth.jwt() ->> 'email')) = 'nikolayivanovhome@gmail.com'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  );

create policy "Chat admin sends replies"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_role = 'staff'
    and lower((select auth.jwt() ->> 'email')) = 'nikolayivanovhome@gmail.com'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  );
