import { supabase } from '../lib/supabaseClient.js';

export async function loginComGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/pages/hoje.html`,
    },
  });
  if (error) throw new Error('Não foi possível iniciar o login com Google. Tente novamente.');
}

export async function loginComEmail(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_grant')) {
      throw new Error('E-mail ou senha incorretos.');
    }
    throw new Error('Não foi possível fazer login. Tente novamente.');
  }
  return data;
}

export async function cadastrarComEmail(email, senha) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  if (error) return { sucesso: false, mensagem: error.message };
  const sessaoAtiva = !!data.session;
  return { sucesso: true, sessaoAtiva, usuario: data.user };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/pages/login.html';
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
