import { exigirSessao } from './lib/authGuard.js';
import { logout } from './services/authService.js';
import { getPerfil, salvarPerfil } from './services/perfilService.js';

const CAMPOS_OBRIGATORIOS = ['idade', 'sexo', 'altura_cm', 'peso_kg', 'objetivo', 'experiencia', 'disponibilidade_semanal', 'local_treino'];

async function init() {
  const session = await exigirSessao();
  if (!session) return;

  document.getElementById('btn-sair').addEventListener('click', logout);

  const { data: perfil } = await getPerfil();
  if (perfil) preencherForm(perfil);

  const isOnboarding = new URLSearchParams(location.search).get('onboarding') === '1';
  if (isOnboarding) {
    document.getElementById('titulo-perfil').textContent = 'Conte sobre você';
    document.getElementById('subtitulo-perfil').textContent =
      'O Coach usa esses dados pra personalizar sua análise.';
  }

  document.getElementById('form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgErro = document.getElementById('msg-erro');
    const btnSalvar = document.getElementById('btn-salvar');
    const textoOriginal = btnSalvar.textContent;
    msgErro.textContent = '';
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    const campos = coletarCampos();
    const { error } = await salvarPerfil(campos);

    if (error) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = textoOriginal;
      msgErro.textContent = 'Erro ao salvar. Tente novamente.';
      return;
    }

    btnSalvar.textContent = textoOriginal === 'Atualizar' ? 'Atualizado!' : 'Salvo!';
    setTimeout(() => { location.replace('./hoje.html'); }, 1500);
  });
}

function coletarCampos() {
  return {
    idade:                   parseInt(document.getElementById('idade').value)                    || null,
    sexo:                    document.getElementById('sexo').value                               || null,
    altura_cm:               parseInt(document.getElementById('altura_cm').value)                || null,
    peso_kg:                 parseFloat(document.getElementById('peso_kg').value)                || null,
    objetivo:                document.getElementById('objetivo').value                           || null,
    experiencia:             document.getElementById('experiencia').value                        || null,
    disponibilidade_semanal: parseInt(document.getElementById('disponibilidade_semanal').value)  || null,
    local_treino:            document.getElementById('local_treino').value                       || null,
    equipamentos:            document.getElementById('equipamentos').value.trim()                || null,
    restricoes:              document.getElementById('restricoes').value.trim()                  || null,
  };
}

function preencherForm(perfil) {
  const set = (id, val) => { if (val != null) document.getElementById(id).value = val; };
  set('idade',                   perfil.idade);
  set('sexo',                    perfil.sexo);
  set('altura_cm',               perfil.altura_cm);
  set('peso_kg',                 perfil.peso_kg);
  set('objetivo',                perfil.objetivo);
  set('experiencia',             perfil.experiencia);
  set('disponibilidade_semanal', perfil.disponibilidade_semanal);
  set('local_treino',            perfil.local_treino);
  set('equipamentos',            perfil.equipamentos);
  set('restricoes',              perfil.restricoes);
  document.getElementById('btn-salvar').textContent = 'Atualizar';
}

init();
