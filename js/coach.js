// js/coach.js
import { getSession, signOut } from './services/authService.js';

async function init() {
  const session = await getSession();
  if (!session) { location.replace('./login.html'); return; }

  document.getElementById('btn-sair').addEventListener('click', async () => {
    await signOut();
    location.replace('./login.html');
  });
}

init();
