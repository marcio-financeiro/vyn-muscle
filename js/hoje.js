// js/hoje.js
import { exigirSessaoEPerfil } from './lib/authGuard.js';
import { logout } from './services/authService.js';
import { logSerie, getHoje as buscarLogsHoje } from './services/treinoService.js';
import { getPerfil } from './services/perfilService.js';
import { supabase } from './lib/supabaseClient.js';

const FOCOS_META = {
  'Superior':   { icone: '🏋️', subtitulo: 'Peito, costas, braços',       tag: 'HIPERTROFIA' },
  'Inferior':   { icone: '🦵', subtitulo: 'Glúteos, coxa, panturrilha',   tag: 'HIPERTROFIA' },
  'Corpo Todo': { icone: '⚡', subtitulo: 'Treino completo balanceado',    tag: 'HIPERTROFIA' },
  'Forca':      { icone: '💪', subtitulo: 'Grandes movimentos compostos',  tag: 'FORÇA'        },
  'Cardio':     { icone: '❤️', subtitulo: 'Resistência e condicionamento', tag: 'CARDIO'       },
};

const FOCO_IA = {
  id:        'ia_personalizada',
  tipo:      'ia_personalizada',
  nome:      'IA Personalizada',
  icone:     '🤖',
  subtitulo: 'Montado pra você agora',
  tag:       'SOB MEDIDA',
  classe:    'ia',
};

let focos      = [];
let planoAtivo = null;
let perfil     = null;
let authSession = null;

async function apiFetch(path, opts = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Sessão inválida');
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(opts.headers || {}),
    },
  });
}

// ── Controle de fluxo ──────────────────────────────────────────────────────

function mostrarFluxo(nome) {
  document.getElementById('loading-msg').style.display = 'none';
  for (const id of ['fluxo-checkin', 'fluxo-selecao', 'fluxo-sessao']) {
    document.getElementById(id).style.display = id === `fluxo-${nome}` ? '' : 'none';
  }
}

async function carregarFluxo() {
  let dados;
  try {
    const resp = await apiFetch('/api/montar-sessao');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    dados = await resp.json();
  } catch {
    const el = document.getElementById('loading-msg');
    el.style.display = '';
    el.textContent = 'Erro ao carregar sessão. Recarregue a página.';
    return;
  }

  if (dados.precisa_checkin) { mostrarFluxo('checkin'); return; }

  if (dados.precisa_plano) {
    if (!focos.length) await carregarFocos();
    renderizarFocos(document.getElementById('foco-grid'), null, null);
    mostrarFluxo('selecao');
    return;
  }

  planoAtivo = dados.plano || null;
  renderizarSessao(dados);
  mostrarFluxo('sessao');
  await carregarHoje();
  configurarTrocarFoco();
}

// ── CHECK-IN ──────────────────────────────────────────────────────────────

function configurarCheckin() {
  const estado = { dormiu_bem: null, teve_dor: null, tempo_disponivel_min: null };

  function selecionar(grupo, valor, el) {
    el.closest('.checkin-opcoes')
      .querySelectorAll('.checkin-opcao')
      .forEach(b => b.classList.remove('selecionado'));
    el.classList.add('selecionado');
    estado[grupo] = valor;

    if (grupo === 'teve_dor') {
      document.getElementById('dor-local-container').style.display = valor ? '' : 'none';
    }

    const pronto = estado.dormiu_bem !== null && estado.teve_dor !== null && estado.tempo_disponivel_min !== null;
    document.getElementById('btn-iniciar').disabled = !pronto;
  }

  document.getElementById('dormiu-sim').addEventListener('click', e => selecionar('dormiu_bem', true,  e.currentTarget));
  document.getElementById('dormiu-nao').addEventListener('click', e => selecionar('dormiu_bem', false, e.currentTarget));
  document.getElementById('dor-nao').addEventListener('click',    e => selecionar('teve_dor', false,   e.currentTarget));
  document.getElementById('dor-sim').addEventListener('click',    e => selecionar('teve_dor', true,    e.currentTarget));
  document.getElementById('tempo-30').addEventListener('click',   e => selecionar('tempo_disponivel_min', 30, e.currentTarget));
  document.getElementById('tempo-45').addEventListener('click',   e => selecionar('tempo_disponivel_min', 45, e.currentTarget));
  document.getElementById('tempo-60').addEventListener('click',   e => selecionar('tempo_disponivel_min', 60, e.currentTarget));

  document.getElementById('btn-iniciar').addEventListener('click', async () => {
    const btn  = document.getElementById('btn-iniciar');
    const erro = document.getElementById('msg-erro-checkin');
    btn.disabled = true;
    btn.textContent = 'Iniciando...';
    erro.textContent = '';

    const resp = await apiFetch('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({
        dormiu_bem:           estado.dormiu_bem,
        teve_dor:             estado.teve_dor,
        dor_local:            document.getElementById('dor-local').value.trim() || null,
        tempo_disponivel_min: estado.tempo_disponivel_min,
      }),
    });

    if (!resp.ok) {
      btn.disabled = false;
      btn.textContent = 'Começar →';
      erro.textContent = 'Erro ao salvar. Tente novamente.';
      return;
    }

    await carregarFluxo();
  });
}

// ── SELEÇÃO DE FOCO ───────────────────────────────────────────────────────

async function carregarFocos() {
  const { data } = await supabase
    .from('focos_treino')
    .select('id, nome, objetivo')
    .order('created_at');
  focos = data || [];
}

function objetivoRecomenda(focoNome, objetivo) {
  const mapa = {
    hipertrofia:     ['Superior', 'Inferior', 'Corpo Todo'],
    forca:           ['Forca'],
    emagrecimento:   ['Cardio', 'Corpo Todo'],
    condicionamento: ['Cardio'],
    saude:           ['Corpo Todo', 'Cardio'],
  };
  return (mapa[objetivo] || []).includes(focoNome);
}

function renderizarFocos(container, focoAtivoId, planoTipo) {
  container.innerHTML = '';
  const objetivo = perfil?.objetivo;
  const todos = [...focos.map(f => ({ ...f, tipo: 'catalogo' })), FOCO_IA];

  for (const foco of todos) {
    const meta = FOCOS_META[foco.nome] || {};
    const estaAtivo = foco.tipo === 'ia_personalizada'
      ? (planoTipo === 'ia_personalizada')
      : (foco.id === focoAtivoId);
    const recomendado = objetivoRecomenda(foco.nome, objetivo);

    const card = document.createElement('div');
    card.className = `foco-card${estaAtivo ? ' ativo' : ''}${foco.classe ? ' ' + foco.classe : ''}`;
    card.innerHTML = `
      ${estaAtivo ? '<span class="foco-badge-ativo">ATIVO</span>' : ''}
      <span class="foco-icone">${foco.icone || meta.icone || '🏅'}</span>
      <p class="foco-titulo">${foco.nome}</p>
      <p class="foco-subtitulo">${foco.subtitulo || meta.subtitulo || ''}</p>
      <span class="foco-tag">${foco.tag || meta.tag || ''}</span>
      ${recomendado ? '<span class="foco-recomendado">★ Recomendado</span>' : ''}
    `;
    card.addEventListener('click', () => escolherFoco(foco.id, foco.tipo, container));
    container.appendChild(card);
  }
}

async function escolherFoco(focoId, tipo, container) {
  container.innerHTML = `<p class="vazio">${tipo === 'ia_personalizada' ? 'Consultando IA...' : 'Aplicando foco...'}</p>`;

  const resp = await apiFetch('/api/escolher-plano', {
    method: 'POST',
    body: JSON.stringify({
      foco_id: tipo === 'ia_personalizada' ? null : focoId,
      tipo,
      modo: 'variado',
    }),
  });

  if (!resp.ok) {
    container.innerHTML = '<p class="vazio">Erro ao salvar foco. Tente novamente.</p>';
    return;
  }

  const dados = await resp.json();
  planoAtivo = dados.plano;
  await carregarFluxo();
}

// ── SESSÃO DO DIA ─────────────────────────────────────────────────────────

function renderizarSessao(dados) {
  const avisoEl = document.getElementById('aviso-dor');
  if (dados.avisos?.length) {
    avisoEl.innerHTML = dados.avisos.map(a => `<p style="margin:0 0 4px">${a}</p>`).join('');
    avisoEl.style.display = '';
  } else {
    avisoEl.style.display = 'none';
  }

  const container = document.getElementById('exercicios-sessao');
  container.innerHTML = '';

  if (!dados.exercicios?.length) {
    container.innerHTML = '<p class="vazio">Sessão sendo preparada...</p>';
    return;
  }

  const titulo = document.createElement('p');
  titulo.className = 'sessao-titulo';
  titulo.textContent = 'Exercícios de hoje';
  container.appendChild(titulo);

  for (const ex of dados.exercicios) {
    const el = document.createElement('div');
    el.className = 'exercicio-sessao';

    const detalhe = ex.tipo === 'bloco'
      ? `${ex.duracao_min}min — ${ex.intensidade}`
      : `${ex.series}×${ex.reps_min}–${ex.reps_max}`;

    const badgeHtml = ex.tipo === 'ancora'
      ? '<span class="ex-badge ancora">ÂNCORA</span>'
      : ex.tipo === 'ia' ? '<span class="ex-badge ia">IA</span>' : '';

    el.innerHTML = `
      <span class="ex-nome">${ex.nome}</span>
      <span class="ex-detalhe">${detalhe}</span>
      ${badgeHtml}
    `;

    el.addEventListener('click', () => {
      document.getElementById('exercicio').value = ex.nome;
      document.getElementById('btn-adicionar').click();
      document.getElementById('exercicio').focus();
    });

    container.appendChild(el);
  }
}

function configurarTrocarFoco() {
  const toggle = document.getElementById('btn-trocar-foco');
  const grid   = document.getElementById('foco-grid-troca');

  grid.style.display = 'none';
  toggle.textContent = 'Trocar foco';

  toggle.onclick = async () => {
    if (!grid.style.display || grid.style.display === 'none') {
      if (!focos.length) await carregarFocos();
      renderizarFocos(grid, planoAtivo?.foco_id, planoAtivo?.tipo);
      grid.style.display = 'grid';
      toggle.textContent = '↑ Fechar';
    } else {
      grid.style.display = 'none';
      toggle.textContent = 'Trocar foco';
    }
  };
}

// ── LOGS DO DIA ──────────────────────────────────────────────────────────

function renderLinha(log, prepend = false) {
  const lista = document.getElementById('lista-hoje');
  lista.querySelector('.vazio')?.remove();
  lista.querySelector('.btn-adicionar')?.remove();

  const el = document.createElement('div');
  el.className = 'linha-log';

  const seriesStr = (log.series && log.reps) ? ` — ${log.series}×${log.reps}` : '';
  const cargaStr  = log.carga != null ? `${log.carga}kg` : '—';
  const rpeClass  = log.rpe >= 9 ? 'rpe alto' : 'rpe';

  const spanEx    = document.createElement('span');
  spanEx.className = 'ex';
  spanEx.textContent = log.exercicio + seriesStr;

  const spanCarga = document.createElement('span');
  spanCarga.className = 'carga';
  spanCarga.textContent = cargaStr;

  const spanRpe   = document.createElement('span');
  spanRpe.className = rpeClass;
  spanRpe.textContent = `RPE ${log.rpe ?? '—'}`;

  el.append(spanEx, spanCarga, spanRpe);
  if (prepend) lista.prepend(el);
  else lista.appendChild(el);
}

async function carregarHoje() {
  const lista = document.getElementById('lista-hoje');
  const { data, error } = await buscarLogsHoje();
  if (error || !data?.length) {
    lista.innerHTML = '<p class="vazio">Nenhuma série registrada hoje.</p>';
    const btnVazio = document.createElement('button');
    btnVazio.className = 'btn-adicionar';
    btnVazio.textContent = '+ Primeira série do dia';
    btnVazio.addEventListener('click', () => document.getElementById('btn-adicionar').click());
    lista.appendChild(btnVazio);
    return;
  }
  lista.innerHTML = '';
  data.forEach(log => renderLinha(log));
}

function configurarFormSerie() {
  const btnAdicionar = document.getElementById('btn-adicionar');
  const formSerie    = document.getElementById('form-serie');
  const btnCancelar  = document.getElementById('btn-cancelar');
  const msgErro      = document.getElementById('msg-erro-form');

  btnAdicionar.addEventListener('click', () => {
    formSerie.classList.add('visivel');
    btnAdicionar.style.display = 'none';
  });

  btnCancelar.addEventListener('click', () => {
    formSerie.classList.remove('visivel');
    btnAdicionar.style.display = '';
    formSerie.reset();
    msgErro.textContent = '';
  });

  formSerie.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar');
    msgErro.textContent = '';
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    const { data, error } = await logSerie({
      exercicio: document.getElementById('exercicio').value.trim(),
      series:    parseInt(document.getElementById('series').value)  || null,
      reps:      parseInt(document.getElementById('reps').value)    || null,
      carga:     parseFloat(document.getElementById('carga').value) || null,
      rpe:       parseInt(document.getElementById('rpe').value)     || null,
      obs:       document.getElementById('obs').value.trim()        || null,
    });

    if (error) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
      msgErro.textContent = 'Não foi possível salvar a série. Tente novamente.';
      return;
    }

    renderLinha(data, true);
    formSerie.classList.remove('visivel');
    btnAdicionar.style.display = '';
    formSerie.reset();
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar';
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────

async function init() {
  authSession = await exigirSessaoEPerfil();
  if (!authSession) return;

  document.getElementById('btn-sair').addEventListener('click', logout);

  const { data: p } = await getPerfil();
  perfil = p;

  configurarCheckin();
  configurarFormSerie();
  await carregarFluxo();
}

init();
