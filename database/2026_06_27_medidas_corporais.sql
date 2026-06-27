-- Novos campos em perfis
ALTER TABLE perfis
  ADD COLUMN IF NOT EXISTS duracao_sessao_min int,
  ADD COLUMN IF NOT EXISTS peso_objetivo_kg numeric;

-- Histórico de medidas corporais — populado automaticamente ao salvar perfil com peso
create table if not exists medidas_corporais (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users,
  data               date default current_date,
  peso_kg            numeric not null,
  cintura_cm         numeric,
  percentual_gordura numeric,
  created_at         timestamptz default now(),
  unique (user_id, data)
);

alter table medidas_corporais enable row level security;

create policy "usuario so ve seus proprios registros de medidas"
  on medidas_corporais for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
