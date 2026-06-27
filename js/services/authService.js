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
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('User already registered')) {
      throw new Error('Este e-mail já está cadastrado. Tente fazer login.');
    }
    throw new Error('Não foi possível criar a conta. Tente novamente.');
  }
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
