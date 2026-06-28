-- Substituir foco único por array de focos (sequência A/B/C)
ALTER TABLE planos_treino
  DROP COLUMN IF EXISTS foco_id,
  DROP COLUMN IF EXISTS exercicios_efetivos,
  ADD COLUMN focos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Armazenar rótulo do treino (ex: "Treino A — Superior") na sessão
ALTER TABLE sessoes_diarias
  ADD COLUMN IF NOT EXISTS treino_label text;
