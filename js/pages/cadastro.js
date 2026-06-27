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

    const resultado = await cadastrarComEmail(email, senha);

    if (!resultado.sucesso) {
      mostrarErro(resultado.mensagem);
      btn.disabled = false;
      return;
    }

    if (resultado.sessaoAtiva) {
      location.replace('./hoje.html');
    } else {
      mostrarMensagemConfirmacao();
    }
  });
}

function mostrarErro(msg) {
  document.getElementById('msg-erro').textContent = msg;
}

function limparErro() {
  document.getElementById('msg-erro').textContent = '';
}

function mostrarMensagemConfirmacao() {
  document.querySelector('.login-card').innerHTML = `
    <div class="logo-area">
      <div class="marca">VYN</div>
      <div class="marca-sub">MUSCLE</div>
    </div>
    <p class="login-title">Quase lá</p>
    <p class="confirmacao-texto">
      Enviamos um link de confirmação pro seu e-mail.<br>
      Clica nele pra ativar sua conta e poder entrar.
    </p>
    <p class="link-modo"><a href="./login.html">Voltar pro login</a></p>
  `;
}

init();
