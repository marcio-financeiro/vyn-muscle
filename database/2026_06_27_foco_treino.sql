-- Sistema de Foco de Treino: 4 tabelas + seed

create table focos_treino (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  objetivo text not null,
  exercicios jsonb not null,
  created_at timestamptz default now()
);
alter table focos_treino enable row level security;
create policy "autenticado le focos"
  on focos_treino for select using (auth.role() = 'authenticated');

create table planos_treino (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  foco_id uuid references focos_treino(id),
  tipo text not null check (tipo in ('catalogo', 'ia_personalizada')),
  modo text not null check (modo in ('fixo', 'variado')),
  exercicios_efetivos jsonb not null default '[]',
  ativo boolean default true,
  created_at timestamptz default now()
);
alter table planos_treino enable row level security;
create policy "usuario planos"
  on planos_treino for all using (auth.uid() = user_id);

create table checkins_diarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  data date default current_date,
  dormiu_bem boolean,
  teve_dor boolean,
  dor_local text,
  tempo_disponivel_min int,
  created_at timestamptz default now(),
  unique (user_id, data)
);
alter table checkins_diarios enable row level security;
create policy "usuario checkins"
  on checkins_diarios for all using (auth.uid() = user_id);

create table sessoes_diarias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  plano_id uuid references planos_treino(id),
  data date default current_date,
  exercicios jsonb not null default '[]',
  avisos jsonb not null default '[]',
  created_at timestamptz default now(),
  unique (user_id, data)
);
alter table sessoes_diarias enable row level security;
create policy "usuario sessoes"
  on sessoes_diarias for all using (auth.uid() = user_id);

-- Seed: 5 focos de treino
insert into focos_treino (nome, objetivo, exercicios) values
('Superior', 'hipertrofia', '[{"nome":"Supino Reto","tipo":"ancora","series":4,"reps_min":8,"reps_max":12,"descanso_seg":90},{"nome":"Remada Curvada","tipo":"ancora","series":4,"reps_min":8,"reps_max":12,"descanso_seg":90},{"nome":"Desenvolvimento de Ombro","tipo":"variavel","series":3,"reps_min":10,"reps_max":15,"descanso_seg":60},{"nome":"Crucifixo","tipo":"variavel","series":3,"reps_min":10,"reps_max":15,"descanso_seg":60},{"nome":"Rosca Direta","tipo":"variavel","series":3,"reps_min":10,"reps_max":15,"descanso_seg":60},{"nome":"Triceps Corda","tipo":"variavel","series":3,"reps_min":10,"reps_max":15,"descanso_seg":60},{"nome":"Puxada na Frente","tipo":"variavel","series":3,"reps_min":10,"reps_max":15,"descanso_seg":60}]'::jsonb),
('Inferior', 'hipertrofia', '[{"nome":"Agachamento","tipo":"ancora","series":4,"reps_min":8,"reps_max":12,"descanso_seg":90},{"nome":"Stiff","tipo":"ancora","series":4,"reps_min":8,"reps_max":12,"descanso_seg":90},{"nome":"Leg Press","tipo":"variavel","series":3,"reps_min":10,"reps_max":15,"descanso_seg":60},{"nome":"Cadeira Extensora","tipo":"variavel","series":3,"reps_min":12,"reps_max":15,"descanso_seg":60},{"nome":"Cadeira Flexora","tipo":"variavel","series":3,"reps_min":12,"reps_max":15,"descanso_seg":60},{"nome":"Elevacao Pelvica","tipo":"variavel","series":3,"reps_min":12,"reps_max":15,"descanso_seg":60},{"nome":"Panturrilha","tipo":"variavel","series":4,"reps_min":15,"reps_max":20,"descanso_seg":45}]'::jsonb),
('Corpo Todo', 'hipertrofia', '[{"nome":"Agachamento","tipo":"ancora","series":3,"reps_min":8,"reps_max":12,"descanso_seg":90},{"nome":"Supino Reto","tipo":"ancora","series":3,"reps_min":8,"reps_max":12,"descanso_seg":90},{"nome":"Remada Curvada","tipo":"variavel","series":3,"reps_min":8,"reps_max":12,"descanso_seg":75},{"nome":"Desenvolvimento de Ombro","tipo":"variavel","series":3,"reps_min":10,"reps_max":12,"descanso_seg":60},{"nome":"Stiff","tipo":"variavel","series":3,"reps_min":10,"reps_max":12,"descanso_seg":75},{"nome":"Rosca Direta","tipo":"variavel","series":2,"reps_min":10,"reps_max":15,"descanso_seg":60}]'::jsonb),
('Forca', 'forca', '[{"nome":"Agachamento","tipo":"ancora","series":5,"reps_min":3,"reps_max":5,"descanso_seg":180},{"nome":"Supino Reto","tipo":"ancora","series":5,"reps_min":3,"reps_max":5,"descanso_seg":180},{"nome":"Levantamento Terra","tipo":"ancora","series":4,"reps_min":3,"reps_max":5,"descanso_seg":180},{"nome":"Desenvolvimento Militar","tipo":"variavel","series":4,"reps_min":5,"reps_max":6,"descanso_seg":120}]'::jsonb),
('Cardio', 'cardio', '[{"nome":"Aquecimento leve","tipo":"bloco","duracao_min":5,"intensidade":"baixa"},{"nome":"Intervalos aerobicos","tipo":"bloco","duracao_min":20,"intensidade":"moderada-alta"},{"nome":"Resistencia continua","tipo":"bloco","duracao_min":15,"intensidade":"moderada"},{"nome":"Desaquecimento","tipo":"bloco","duracao_min":5,"intensidade":"baixa"}]'::jsonb);
