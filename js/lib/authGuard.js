import { supabase } from './supabaseClient.js';

export async function exigirSessao() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/pages/login.html';
    return null;
  }
  return session;
}

export async function exigirSessaoEPerfil() {
  const session = await exigirSessao();
  if (!session) return null;

  const { data: perfil } = await supabase
    .from('perfis')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!perfil) {
    window.location.href = '/pages/perfil.html?onboarding=1';
    return null;
  }

  return session;
}
