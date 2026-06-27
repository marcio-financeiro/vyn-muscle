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
  return supabase
    .from('perfis')
    .upsert({ user_id: session.user.id, ...campos }, { onConflict: 'user_id' })
    .select()
    .single();
}
