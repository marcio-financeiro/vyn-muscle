import { exigirSessao } from './lib/authGuard.js';
import { logout } from './services/authService.js';
import { perguntarCoach } from './services/coachService.js';

async function init() {
  const session = await exigirSessao();
  if (!session) return;

  document.getElementById('btn-sair').addEventListener('click', logout);
  carregarInsights(session);
  configurarForm(session);
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
      container.innerHTML = `<p class="vazio">${dados.erro}</p>`;
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

function configurarForm(session) {
  const form = document.getElementById('form-pergunta');
  const btn = document.getElementById('btn-perguntar');
  const campo = document.getElementById('campo-pergunta');
  const container = document.getElementById('resposta-coach');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pergunta = campo.value.trim();
    if (!pergunta) return;

    btn.disabled = true;
    container.innerHTML = '<p class="vazio">Consultando o coach...</p>';

    try {
      const sugestao = await perguntarCoach(pergunta, session);
      const perguntaSegura = pergunta.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      container.innerHTML = `
        <div class="card-coach">
          <div class="linha-log">
            <span class="ex">Você perguntou</span>
          </div>
          <p class="pergunta-usuario">${perguntaSegura}</p>
          <div class="anotacao-ia">
            <span class="tag">Resposta do Coach</span>
            ${sugestao}
          </div>
        </div>
      `;
    } catch {
      container.innerHTML = '<p class="vazio">Erro ao conectar com o coach. Tenta de novo.</p>';
    } finally {
      btn.disabled = false;
    }
  });
}

init();
