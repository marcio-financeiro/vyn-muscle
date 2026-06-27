// js/historico.js
import { exigirSessao } from './lib/authGuard.js';
import { logout } from './services/authService.js';
import { getTodosLogs } from './services/treinoService.js';

function formatarData(isoDate) {
  const [, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}`;
}

function renderHistorico(data) {
  const lista = document.getElementById('lista-historico');

  if (!data?.length) {
    lista.innerHTML = '<p class="vazio">Nenhum treino registrado ainda. Registre a primeira série em Hoje.</p>';
    return;
  }

  // Agrupar por data (campo date do banco)
  const grupos = {};
  data.forEach(log => {
    const chave = log.data;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(log);
  });

  lista.innerHTML = '';
  Object.keys(grupos)
    .sort((a, b) => b.localeCompare(a))
    .forEach(dataStr => {
      const cabecalho = document.createElement('div');
      cabecalho.className = 'grupo-data';
      cabecalho.textContent = formatarData(dataStr);
      lista.appendChild(cabecalho);

      grupos[dataStr].forEach(log => {
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
        lista.appendChild(el);
      });
    });
}

async function init() {
  const session = await exigirSessao();
  if (!session) return;

  document.getElementById('btn-sair').addEventListener('click', logout);

  const { data, error } = await getTodosLogs();
  if (error) {
    document.getElementById('lista-historico').innerHTML =
      '<p class="vazio">Erro ao carregar histórico.</p>';
    return;
  }
  renderHistorico(data);
}

init();
