import { cadastrarComEmail, loginComGoogle, getSession } from '../services/authService.js';

async function init() {
  const session = await getSession();
  if (session) { location.replace('./hoje.html'); return; }

  document.getElementById('btn-google').addEventListener('click', async () => {
    const btn = document.getElementById('btn-google');
    btn.disabled = true;
    try {
      await loginComGoogle();
      btn.disabled = false;
    } catch (err) {
      mostrarErro(err.message);
      btn.disabled = false;
    }
  });

  document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const btn   = document.getElementById('btn-cadastrar');

    btn.disabled = true;
    limparErro();

    try {
      await cadastrarComEmail(email, senha);
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
