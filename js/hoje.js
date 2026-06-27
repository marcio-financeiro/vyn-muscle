// js/hoje.js
import { exigirSessaoEPerfil } from './lib/authGuard.js';
import { logout } from './services/authService.js';
import { logSerie, getHoje } from './services/treinoService.js';

function renderLinha(log, prepend = false) {
  const lista = document.getElementById('lista-hoje');
  const vazio = lista.querySelector('.vazio');
  if (vazio) vazio.remove();

  const el = document.createElement('div');
  el.className = 'linha-log';

  const seriesStr = (log.series && log.reps) ? ` — ${log.series}×${log.reps}` : '';
  const cargaStr  = log.carga != null ? `${log.carga}kg` : '—';
  const rpeClass  = log.rpe >= 9 ? 'rpe alto' : 'rpe';

  const spanEx = document.createElement('span');
  spanEx.className = 'ex';
  spanEx.textContent = log.exercicio + seriesStr;

  const spanCarga = document.createElement('span');
  spanCarga.className = 'carga';
  spanCarga.textContent = cargaStr;

  const spanRpe = document.createElement('span');
  spanRpe.className = rpeClass;
  spanRpe.textContent = `RPE ${log.rpe ?? '—'}`;

  el.append(spanEx, spanCarga, spanRpe);
  if (prepend) lista.prepend(el);
  else lista.appendChild(el);
}

async function carregarHoje() {
  const lista = document.getElementById('lista-hoje');
  const { data, error } = await getHoje();
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

async function init() {
  const session = await exigirSessaoEPerfil();
  if (!session) return;

  document.getElementById('btn-sair').addEventListener('click', logout);

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
      series: parseInt(document.getElementById('series').value)  || null,
      reps:   parseInt(document.getElementById('reps').value)    || null,
      carga:  parseFloat(document.getElementById('carga').value) || null,
      rpe:    parseInt(document.getElementById('rpe').value)     || null,
      obs:    document.getElementById('obs').value.trim()        || null,
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

  await carregarHoje();
}

init();
