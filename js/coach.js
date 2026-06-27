// js/coach.js
import { exigirSessao } from './lib/authGuard.js';
import { logout } from './services/authService.js';

async function init() {
  const session = await exigirSessao();
  if (!session) return;

  document.getElementById('btn-sair').addEventListener('click', logout);
}

init();
