// js/coach.js
import { exigirSessao } from './lib/authGuard.js';
import { logout } from './services/authService.js';

async function init() {
  const session = await exigirSessao();
  if (!session) return;

  document.getElementById('btn-sair').addEventListener('click', logout);
  carregarInsights(session);
}

async function carregarInsights(session) {
  const container = document.getElementById('coach-insights');

  try {
    const resp = await fetch('/api/coach', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const dados = await resp.json();

    if (dados.erro) {
      container.innerHTML = '<p class="vazio">Não foi possível analisar agora. Tenta de novo mais tarde.</p>';
      return;
    }

    if (!dados.insights || dados.insights.length === 0) {
      container.innerHTML = '<p class="vazio">Registra pelo menos 2 sessões do mesmo exercício pra eu conseguir analisar.</p>';
      return;
    }

    container.innerHTML = dados.insights.map(renderCard).join('');
  } catch {
    container.innerHTML = '<p class="vazio">Erro ao conectar com o coach. Tenta de novo.</p>';
  }
}

function renderCard(insight) {
  const seta = insight.tendencia === 'subindo' ? '↑' : insight.tendencia === 'caindo' ? '↓' : '→';
  return `
    <div class="card-coach">
      <div class="linha-log">
        <span class="ex">${insight.exercicio}</span>
        <span class="carga">${seta} ${insight.tendencia}</span>
      </div>
      <div class="anotacao-ia">
        <span class="tag">Anotação da IA</span>
        ${insight.anotacao}
      </div>
    </div>
  `;
}

init();
