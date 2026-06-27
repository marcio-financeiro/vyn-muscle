// js/services/treinoService.js
import { supabase } from '../supabase.js';
import { getSession } from './authService.js';

export async function logSerie({ exercicio, series, reps, carga, rpe, obs }) {
  const session = await getSession();
  return supabase
    .from('treino_logs')
    .insert({
      user_id:  session.user.id,
      exercicio,
      series:   series  || null,
      reps:     reps    || null,
      carga:    carga   || null,
      rpe:      rpe     || null,
      obs:      obs     || null,
    })
    .select()
    .single();
}

export async function getHoje() {
  const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return supabase
    .from('treino_logs')
    .select('*')
    .eq('data', hoje)
    .order('created_at', { ascending: false });
}

export async function getTodosLogs() {
  return supabase
    .from('treino_logs')
    .select('*')
    .order('created_at', { ascending: false });
}
