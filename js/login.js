// js/login.js
import { signIn, signUp, getSession } from './services/authService.js';

async function init() {
  const session = await getSession();
  if (session) { location.replace('./hoje.html'); return; }
  setupForm();
}

function setupForm() {
  let modo = 'login';

  const form        = document.getElementById('form-login');
  const btnSubmit   = document.getElementById('btn-submit');
  const inputEmail  = document.getElementById('email');
  const inputSenha  = document.getElementById('senha');
  const msgErro     = document.getElementById('msg-erro');
  const labelTitulo = document.getElementById('label-titulo');
  const linkModo    = document.getElementById('link-modo');

  linkModo.addEventListener('click', () => {
    modo = modo === 'login' ? 'cadastro' : 'login';
    const isCadastro = modo === 'cadastro';
    labelTitulo.textContent = isCadastro ? 'Criar conta' : 'Entrar';
    btnSubmit.textContent   = isCadastro ? 'Criar conta' : 'Entrar';
    linkModo.innerHTML = isCadastro
      ? 'Já tem conta? <span>Entrar</span>'
      : 'Não tem conta? <span>Criar conta</span>';
    msgErro.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgErro.textContent = '';
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Aguarde...';

    const fn = modo === 'login' ? signIn : signUp;
    const { error } = await fn(inputEmail.value.trim(), inputSenha.value);

    if (error) {
      msgErro.textContent = error.message;
      btnSubmit.disabled = false;
      btnSubmit.textContent = modo === 'login' ? 'Entrar' : 'Criar conta';
      return;
    }

    location.replace('./hoje.html');
  });
}

init();
