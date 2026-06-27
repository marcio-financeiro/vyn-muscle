// api/checkin.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ erro: 'Não autenticado' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return res.status(500).json({ erro: 'Configuração de ambiente ausente' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return res.status(401).json({ erro: 'Sessão inválida' });

  const { dormiu_bem, teve_dor, dor_local, tempo_disponivel_min } = req.body || {};

  const hoje = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from('checkins_diarios')
    .upsert(
      {
        user_id: user.id,
        data: hoje,
        dormiu_bem: dormiu_bem ?? null,
        teve_dor: teve_dor ?? null,
        dor_local: (teve_dor && dor_local) ? dor_local.trim() : null,
        tempo_disponivel_min: tempo_disponivel_min || null,
      },
      { onConflict: 'user_id,data' }
    );

  if (error) return res.status(500).json({ erro: 'Erro ao salvar check-in' });

  return res.status(200).json({ ok: true });
};
