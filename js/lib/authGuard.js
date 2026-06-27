import { supabase } from './supabaseClient.js';

export async function exigirSessao() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/pages/login.html';
    return null;
  }
  return session;
}
