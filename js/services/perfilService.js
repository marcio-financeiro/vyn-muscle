import { supabase } from '../lib/supabaseClient.js';

export async function getPerfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: new Error('Sem sessão') };
  return supabase
    .from('perfis')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
}

export async function salvarPerfil(campos) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: new Error('Sem sessão') };

  const resp = await fetch('/api/perfil', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(campos),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return { data: null, error: new Error(err.erro || 'Erro ao salvar perfil') };
  }

  return { data: await resp.json(), error: null };
}
