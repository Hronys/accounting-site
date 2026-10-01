-- Keep the online indicator tied to a verified administrator session.
drop policy if exists "Chat clients read administrator presence" on realtime.messages;
drop policy if exists "Chat administrator publishes presence" on realtime.messages;

create policy "Chat clients read administrator presence"
  on realtime.messages for select to authenticated
  using (
    (select realtime.topic()) = 'chat-admin-presence'
    and realtime.messages.extension = 'presence'
    and (
      (select auth.jwt() ->> 'is_anonymous') = 'true'
      or lower((select auth.jwt() ->> 'email')) = 'ivanovwork@abv.bg'
    )
  );

create policy "Chat administrator publishes presence"
  on realtime.messages for insert to authenticated
  with check (
    (select realtime.topic()) = 'chat-admin-presence'
    and realtime.messages.extension = 'presence'
    and lower((select auth.jwt() ->> 'email')) = 'ivanovwork@abv.bg'
    and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  );
