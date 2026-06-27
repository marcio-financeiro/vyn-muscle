-- Substitui campo fixo 'idade' por 'data_nascimento'.
-- Idade é calculada dinamicamente em js/utils/idade.js (front) e api/coach.js (back).
-- ATENÇÃO: usuários com 'idade' preenchida terão o campo zerado — precisam
-- re-preencher a data de nascimento no próximo acesso ao Perfil.
ALTER TABLE perfis
  DROP COLUMN idade,
  ADD COLUMN data_nascimento date;
