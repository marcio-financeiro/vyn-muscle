create table if not exists perfis (
  user_id               uuid primary key references auth.users,
  idade                 int,
  sexo                  text check (sexo in ('M', 'F', 'outro')),
  altura_cm             int,
  peso_kg               numeric,
  objetivo              text,
  experiencia           text check (experiencia in ('iniciante', 'intermediario', 'avancado')),
  disponibilidade_semanal int,
  local_treino          text check (local_treino in ('academia', 'casa')),
  equipamentos          text,
  restricoes            text,
  created_at            timestamptz default now()
);

alter table perfis enable row level security;

create policy "usuario so ve e edita seu proprio perfil"
  on perfis for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
