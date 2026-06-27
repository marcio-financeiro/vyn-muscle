# Spec — Vyn Muscle MVP Semanas 1–2

**Data:** 2026-06-27  
**Escopo:** 3 telas funcionais + Supabase Auth + tabela `treino_logs`. Sem IA, sem `/api/coach`.

---

## Objetivo

Validar o fluxo completo de registro de treino de ponta a ponta: usuário loga, registra série, vê histórico. A tela Coach existe como UI estática para não bloquear o MVP visual.

---

## Arquitetura

```
muscle-vyn/
  pages/
    login.html        ← Auth email/senha (Supabase)
    hoje.html         ← Lista do dia + formulário de nova série
    historico.html    ← Todos os logs, ordem decrescente
    coach.html        ← UI estática do mockup (sem chamada IA)
  js/
    config.js         ← SUPABASE_URL + SUPABASE_KEY
    services/
      authService.js  ← signIn, signUp, signOut, getSession
      treinoService.js← logSerie, getHoje, getTodosLogs
  css/
    tokens.css        ← já existe — fonte única de cor e fonte
    app.css           ← estilos das telas (só importa tokens, sem hex direto)
  database/
    2026_06_27_treino_logs.sql
  index.html          ← redirect para pages/hoje.html (ou login se sem sessão)
```

**Regra inviolável (CLAUDE.md):** telas só coletam input e chamam `js/services/*`. Nenhuma lógica de negócio dentro de HTML ou script inline nas telas.

---

## Supabase

- **Projeto:** `vyn-muscle` (ID: `kfohwrssrnblilcqpjdc`)
- **URL:** `https://kfohwrssrnblilcqpjdc.supabase.co`
- **Key:** publishable key (formato `sb_publishable_...`) — recomendado para projetos novos
- **Auth:** email/senha nativo do Supabase (sem OAuth por agora)
- **SDK:** `@supabase/supabase-js@2` via CDN ESM (`https://esm.sh/@supabase/supabase-js@2`)

---

## Modelo de dados

```sql
create table treino_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  data date default current_date,
  exercicio text not null,
  series int,
  reps int,
  carga numeric,
  rpe int,   -- 1-10; contexto principal para o Coach futuramente
  obs text,
  created_at timestamptz default now()
);

alter table treino_logs enable row level security;

-- SELECT e INSERT: próprio usuário
create policy "select próprio" on treino_logs
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "insert próprio" on treino_logs
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

-- UPDATE e DELETE: próprio usuário
create policy "update próprio" on treino_logs
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "delete próprio" on treino_logs
  for delete to authenticated
  using ( (select auth.uid()) = user_id );
```

**Nota de segurança:** policies separadas por operação (não `for all`) e UPDATE tem `with check` para impedir reassign de `user_id`.

---

## Telas

### login.html
- Formulário: e-mail + senha + botão "Entrar"
- Link "Criar conta" alterna para modo cadastro (mesmo formulário, chama `signUp`)
- Após login: redirect para `pages/hoje.html`
- Visual: fundo Ferro, card Concreto centralizado, CTA em Forja

### hoje.html
- Header: logo Vyn Muscle + botão Sair
- Nav: Hoje | Histórico | Coach
- Lista dos logs do dia (`data = current_date`) em `.linha-log` (exercício / carga / RPE)
- Botão "+ Série" abre formulário inline (sem modal): exercício, séries, reps, carga, RPE, obs
- Salvar chama `treinoService.logSerie()`, atualiza lista sem reload
- Estado vazio: "Nenhuma série registrada hoje." (tom da voz do brand book)

### historico.html
- Mesma nav
- Todos os logs do usuário, order by `created_at desc`
- Agrupados por data (ex: "27/06 — Supino reto · 4×8 · 80kg · RPE 7")
- Estado vazio: "Nenhum treino registrado ainda. Registre a primeira série em Hoje."

### coach.html
- Mesma nav
- UI estática do mockup do brand book: `.linha-log` + `.anotacao-ia`
- Texto placeholder: "O Coach analisa seu histórico e sugere ajustes. Disponível em breve."
- Sem chamada de API — Semana 3

---

## Visual

Tudo deriva de `css/tokens.css`:
- Fundo: `var(--ferro)` com textura `.papel-log`
- Cards/inputs: `var(--concreto)`
- Texto principal: `var(--cal)`, secundário: `var(--po)`
- Forja (`#D6451B`): só CTA principal (botão "Entrar", botão "+ Série")
- RPE 9-10: `var(--brasa)` na célula da linha de log
- Fontes: Anton (display/logo), IBM Plex Mono (dados tabulares), Inter (corpo)

---

## Fora de escopo

- `/api/coach` e chamada à IA (Semana 3)
- PWA (manifest + service worker) — depois do MVP validar
- Editar/excluir série (não pedido)
- Foto, bioimpedância, wearables, white label

---

## Critério de conclusão

1. `login.html` cria conta e loga com e-mail real
2. `hoje.html` grava série no Supabase e exibe na lista imediatamente
3. `historico.html` lista todos os registros do usuário logado
4. `coach.html` renderiza UI estática sem erro no console
5. Playwright confirma os 3 fluxos antes do push
