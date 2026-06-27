import { loginComEmail, loginComGoogle, getSession } from '../services/authService.js';

async function init() {
  const session = await getSession();
  if (session) { location.replace('./hoje.html'); return; }

  document.getElementById('btn-google').addEventListener('click', async () => {
    const btn = document.getElementById('btn-google');
    btn.disabled = true;
    try {
      await loginComGoogle();
      // loginComGoogle navega o browser pro Google — se chegar aqui é erro
      btn.disabled = false;
    } catch (err) {
      mostrarErro(err.message);
      btn.disabled = false;
    }
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const btn   = document.getElementById('btn-entrar');

    btn.disabled = true;
    limparErro();

    try {
      await loginComEmail(email, senha);
      location.replace('./hoje.html');
    } catch (err) {
      mostrarErro(err.message);
      btn.disabled = false;
    }
  });
}

function mostrarErro(msg) {
  document.getElementById('msg-erro').textContent = msg;
}

function limparErro() {
  document.getElementById('msg-erro').textContent = '';
}

init();
