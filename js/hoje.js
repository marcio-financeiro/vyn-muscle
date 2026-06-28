// js/hoje.js
import { exigirSessaoEPerfil } from './lib/authGuard.js';

function normalizar(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
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

let focos        = [];
let planoAtivo   = null;
let perfil       = null;
let authSession  = null;
let selecaoFocos = []; // [{id, nome}] — ordem é a sequência A/B/C

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

// ── Checklist de progresso (simulado no client) ────────────────────────────

function mostrarChecklist(el, itens) {
  el.innerHTML = `<ul class="checklist-progresso">${
    itens.map(t => `<li class="checklist-item"><span class="checklist-icone">○</span>${t}</li>`).join('')
  }</ul>`;
  el.style.display = '';

  let idx = 0;
  const items = el.querySelectorAll('.checklist-item');

  function marcar(i) {
    if (!items[i]) return;
    items[i].querySelector('.checklist-icone').textContent = '✓';
    items[i].classList.add('concluido');
  }

  const delay = () => 600 + Math.floor(Math.random() * 200);
  let timer = setTimeout(function tick() {
    if (idx < itens.length - 1) {
      marcar(idx++);
      timer = setTimeout(tick, delay());
    }
  }, delay());

  return function concluir() {
    clearTimeout(timer);
    for (let i = idx; i < itens.length; i++) marcar(i);
  };
}

// ── Controle de fluxo ──────────────────────────────────────────────────────

function mostrarFluxo(nome) {
  document.getElementById('loading-msg').style.display = 'none';
  for (const id of ['fluxo-checkin', 'fluxo-selecao', 'fluxo-sessao']) {
    document.getElementById(id).style.display = id === `fluxo-${nome}` ? '' : 'none';
  }
}

async function carregarFluxo() {
  const loadingEl = document.getElementById('loading-msg');
  loadingEl.className = '';
  for (const id of ['fluxo-checkin', 'fluxo-selecao', 'fluxo-sessao']) {
    document.getElementById(id).style.display = 'none';
  }

  const concluir = mostrarChecklist(loadingEl, [
    'Verificando seu check-in',
    'Selecionando o treino de hoje',
    'Ajustando pela sua sessão',
    'Pronto',
  ]);

  let dados;
  try {
    const resp = await apiFetch('/api/montar-sessao');
    concluir();
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.erro || `HTTP ${resp.status}`);
    }
    dados = await resp.json();
  } catch (err) {
    loadingEl.innerHTML = `<span>${err.message || 'Erro ao carregar sessão.'}</span>
      <br><button class="btn-secondary" style="margin-top:12px" onclick="location.reload()">Tentar de novo</button>`;
    return;
  }

  if (dados.precisa_checkin) { mostrarFluxo('checkin'); return; }

  if (dados.precisa_plano) {
    if (!focos.length) await carregarFocos();
    const btnConfirmar = document.getElementById('btn-confirmar-sequencia');
    renderizarFocos(document.getElementById('foco-grid'), btnConfirmar);
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

function renderizarFocos(container, btnConfirmar) {
  container.innerHTML = '';
  selecaoFocos = [];

  const objetivo = perfil?.objetivo;
  const todos = [...focos.map(f => ({ ...f, tipo: 'catalogo' })), FOCO_IA];

  for (const foco of todos) {
    const meta = FOCOS_META[foco.nome] || {};
    const recomendado = objetivoRecomenda(foco.nome, objetivo);

    const card = document.createElement('div');
    card.className = `foco-card${foco.classe ? ' ' + foco.classe : ''}`;
    if (foco.tipo !== 'ia_personalizada') card.dataset.focoId = foco.id;

    card.innerHTML = `
      <span class="foco-icone">${foco.icone || meta.icone || '🏅'}</span>
      <p class="foco-titulo">${foco.nome}</p>
      <p class="foco-subtitulo">${foco.subtitulo || meta.subtitulo || ''}</p>
      <span class="foco-tag">${foco.tag || meta.tag || ''}</span>
      ${recomendado ? '<span class="foco-recomendado">★ Recomendado</span>' : ''}
    `;

    if (foco.tipo === 'ia_personalizada') {
      card.addEventListener('click', () => confirmarIAPersonalizada(container, btnConfirmar));
    } else {
      card.addEventListener('click', () => toggleFocoSelecao(foco, container, btnConfirmar));
    }

    container.appendChild(card);
  }

  if (btnConfirmar) {
    btnConfirmar.style.display = '';
    btnConfirmar.disabled = true;
  }
}

function toggleFocoSelecao(foco, container, btnConfirmar) {
  const idx = selecaoFocos.findIndex(f => f.id === foco.id);
  if (idx >= 0) {
    selecaoFocos.splice(idx, 1);
  } else if (selecaoFocos.length < 3) {
    selecaoFocos.push({ id: foco.id, nome: foco.nome });
  }

  // Atualiza badges numerados em todos os cards
  container.querySelectorAll('.foco-card[data-foco-id]').forEach(card => {
    const cardIdx = selecaoFocos.findIndex(f => f.id === card.dataset.focoId);
    card.querySelector('.foco-badge-seq')?.remove();
    card.classList.toggle('selecionado', cardIdx >= 0);
    if (cardIdx >= 0) {
      const badge = document.createElement('span');
      badge.className = 'foco-badge-seq';
      badge.textContent = cardIdx + 1;
      card.prepend(badge);
    }
  });

  if (btnConfirmar) btnConfirmar.disabled = selecaoFocos.length === 0;
}

async function confirmarSelecao(container, btnConfirmar) {
  if (!selecaoFocos.length) return;

  if (btnConfirmar) btnConfirmar.style.display = 'none';
  const concluir = mostrarChecklist(container, [
    'Lendo seu perfil',
    'Aplicando suas restrições',
    'Montando sua sequência',
    'Pronto',
  ]);

  let resp;
  try {
    resp = await apiFetch('/api/escolher-plano', {
      method: 'POST',
      body: JSON.stringify({
        focoIds: selecaoFocos.map(f => f.id),
        tipo: 'catalogo',
        modo: 'variado',
      }),
    });
  } catch {
    concluir();
    container.innerHTML = '<p class="vazio">Erro de rede. Tente novamente.</p>';
    return;
  }

  concluir();

  if (!resp.ok) {
    container.innerHTML = '<p class="vazio">Erro ao salvar foco. Tente novamente.</p>';
    return;
  }

  const dados = await resp.json();
  planoAtivo = dados.plano;
  await carregarFluxo();
}

async function confirmarIAPersonalizada(container, btnConfirmar) {
  if (btnConfirmar) btnConfirmar.style.display = 'none';
  const concluir = mostrarChecklist(container, [
    'Lendo seu perfil',
    'Aplicando suas restrições',
    'Montando sua sequência',
    'Pronto',
  ]);

  let resp;
  try {
    resp = await apiFetch('/api/escolher-plano', {
      method: 'POST',
      body: JSON.stringify({ tipo: 'ia_personalizada', modo: 'variado' }),
    });
  } catch {
    concluir();
    container.innerHTML = '<p class="vazio">Erro de rede. Tente novamente.</p>';
    return;
  }

  concluir();

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
  titulo.textContent = dados.treino_label || 'Exercícios de hoje';
  container.appendChild(titulo);

  for (const ex of dados.exercicios) {
    const el = document.createElement('div');
    el.className = 'exercicio-sessao';

    const tipoNorm = normalizar(ex.tipo);

    const detalhe = tipoNorm === 'bloco'
      ? `${ex.duracao_min}min — ${ex.intensidade}`
      : (ex.series && ex.reps_min)
        ? `${ex.series} séries × ${ex.reps_min}–${ex.reps_max} reps · ${ex.descanso_seg}s`
        : '';

    const badgeHtml = tipoNorm === 'ancora'
      ? '<span class="ex-badge ancora">ÂNCORA</span>'
      : tipoNorm === 'ia' ? '<span class="ex-badge ia">IA</span>' : '';

    el.innerHTML = `
      <div class="ex-info">
        <span class="ex-nome">${ex.nome}</span>
        ${badgeHtml}
        ${detalhe ? `<span class="ex-detalhe">${detalhe}</span>` : ''}
      </div>
      <button class="btn-reg-ex" type="button" aria-label="Registrar série de ${ex.nome}">+ Reg</button>
    `;

    el.querySelector('.btn-reg-ex').addEventListener('click', () => {
      document.getElementById('exercicio').value = ex.nome;
      const formSerie = document.getElementById('form-serie');
      formSerie.classList.add('visivel');
      document.getElementById('exercicio').focus();
    });

    container.appendChild(el);
  }
}

function configurarTrocarFoco() {
  const toggle          = document.getElementById('btn-trocar-foco');
  const grid            = document.getElementById('foco-grid-troca');
  const btnConfirmarTroca = document.getElementById('btn-confirmar-troca');

  grid.style.display = 'none';
  btnConfirmarTroca.style.display = 'none';
  toggle.textContent = 'Trocar foco';

  btnConfirmarTroca.onclick = () => confirmarSelecao(grid, btnConfirmarTroca);

  toggle.onclick = async () => {
    if (!grid.style.display || grid.style.display === 'none') {
      if (!focos.length) await carregarFocos();
      renderizarFocos(grid, btnConfirmarTroca);
      grid.style.display = 'grid';
      btnConfirmarTroca.disabled = true;
      btnConfirmarTroca.style.display = '';
      toggle.textContent = '↑ Fechar';
    } else {
      grid.style.display = 'none';
      btnConfirmarTroca.style.display = 'none';
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
    return;
  }
  lista.innerHTML = '';
  data.forEach(log => renderLinha(log));
}

function configurarFormSerie() {
  const formSerie   = document.getElementById('form-serie');
  const btnCancelar = document.getElementById('btn-cancelar');
  const msgErro     = document.getElementById('msg-erro-form');

  btnCancelar.addEventListener('click', () => {
    formSerie.classList.remove('visivel');
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
    formSerie.reset();
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar';
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────

// Conecta botão "Confirmar sequência" da tela de seleção inicial
function configurarBtnConfirmarSelecao() {
  const btn = document.getElementById('btn-confirmar-sequencia');
  const grid = document.getElementById('foco-grid');
  btn.addEventListener('click', () => confirmarSelecao(grid, btn));
}

async function init() {
  authSession = await exigirSessaoEPerfil();
  if (!authSession) return;

  document.getElementById('btn-sair').addEventListener('click', logout);

  const { data: p } = await getPerfil();
  perfil = p;

  configurarCheckin();
  configurarFormSerie();
  configurarBtnConfirmarSelecao();
  await carregarFluxo();
}

init();
