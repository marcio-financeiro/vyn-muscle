const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ erro: 'Sessão inválida' });
  }

  const campos = req.body;
  if (!campos || typeof campos !== 'object') {
    return res.status(400).json({ erro: 'Body inválido' });
  }

  const { error: perfilError } = await supabase
    .from('perfis')
    .upsert({ user_id: user.id, ...campos }, { onConflict: 'user_id' });

  if (perfilError) {
    return res.status(500).json({ erro: 'Erro ao salvar perfil' });
  }

  if (campos.peso_kg != null) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error: medidaError } = await supabase
      .from('medidas_corporais')
      .upsert(
        { user_id: user.id, data: hoje, peso_kg: campos.peso_kg },
        { onConflict: 'user_id,data' }
      );
    if (medidaError) {
      console.error('Erro ao registrar medida corporal:', medidaError.message);
    }
  }

  return res.status(200).json({ ok: true });
};
