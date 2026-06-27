create table if not exists treino_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  data       date not null default current_date,
  exercicio  text not null,
  series     int,
  reps       int,
  carga      numeric,
  rpe        int check (rpe between 1 and 10),
  obs        text,
  created_at timestamptz not null default now()
);

alter table treino_logs enable row level security;

create policy "select proprio" on treino_logs
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "insert proprio" on treino_logs
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "update proprio" on treino_logs
  for update to authenticated
  using  ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "delete proprio" on treino_logs
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

grant select, insert, update, delete on treino_logs to authenticated;
