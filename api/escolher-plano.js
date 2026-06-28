// api/escolher-plano.js
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

  const { foco_id, tipo = 'catalogo', modo = 'variado' } = req.body || {};

  let exercicios_efetivos = [];
  let avisos = [];

  if (tipo === 'catalogo') {
    if (!foco_id) return res.status(400).json({ erro: 'foco_id obrigatório para tipo catalogo' });

    const { data: foco, error: focoError } = await supabase
      .from('focos_treino')
      .select('*')
      .eq('id', foco_id)
      .single();

    if (focoError || !foco) return res.status(400).json({ erro: 'Foco não encontrado' });

    exercicios_efetivos = foco.exercicios;

    const { data: perfil } = await supabase
      .from('perfis')
      .select('restricoes')
      .eq('user_id', user.id)
      .maybeSingle();

    if (perfil?.restricoes) {
      const adaptado = await adaptarPorRestricao(foco.exercicios, perfil.restricoes);
      exercicios_efetivos = adaptado.exercicios;
      avisos = adaptado.avisos;
    }
  }
  // ia_personalizada: exercicios_efetivos = [] (gerado por /api/montar-sessao)

  // Desativar planos anteriores
  await supabase
    .from('planos_treino')
    .update({ ativo: false })
    .eq('user_id', user.id)
    .eq('ativo', true);

  // Apagar sessão do dia atual para forçar reconstrução
  const hoje = new Date().toISOString().slice(0, 10);
  await supabase
    .from('sessoes_diarias')
    .delete()
    .eq('user_id', user.id)
    .eq('data', hoje);

  const { data: novoPlano, error: planoError } = await supabase
    .from('planos_treino')
    .insert({
      user_id: user.id,
      foco_id: foco_id || null,
      tipo,
      modo,
      exercicios_efetivos,
      ativo: true,
    })
    .select()
    .single();

  if (planoError) return res.status(500).json({ erro: 'Erro ao salvar plano' });

  return res.status(200).json({ plano: novoPlano, avisos });
};

async function adaptarPorRestricao(exercicios, restricoes) {
  if (!process.env.ANTHROPIC_API_KEY) return { exercicios, avisos: [] };

  const listaStr = exercicios
    .filter(e => e.tipo !== 'bloco')
    .map(e => `- ${e.nome} (${e.tipo})`)
    .join('\n');

  if (!listaStr) return { exercicios, avisos: [] };

  const prompt = `Você é um personal trainer. O usuário tem: "${restricoes}".

Exercícios do treino:
${listaStr}

Para cada exercício que conflite com a restrição, sugira uma substituição que trabalhe o mesmo grupo muscular e mantenha o mesmo tipo (ancora/variavel).
Se a restrição for lesão grave (cirurgia, ruptura, hérnia), inclua aviso de liberação médica.

Responda APENAS em JSON válido, sem texto antes ou depois:
{"exercicios":[/* mesmos campos originais, nome substituído onde necessário */],"avisos":["string"]}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) return { exercicios, avisos: [] };

    const dados = await resp.json();
    const texto = dados.content?.[0]?.text ?? '';
    const limpo = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const resultado = JSON.parse(limpo);

    // Preservar campos de prescrição do foco original — a IA só troca o nome
    const adaptados = (resultado.exercicios || []).map((aiEx, i) => {
      const original = exercicios[i] || {};
      return {
        nome:         aiEx.nome ?? original.nome,
        tipo:         original.tipo,          // tipo normalizado do catálogo
        series:       original.series,
        reps_min:     original.reps_min,
        reps_max:     original.reps_max,
        descanso_seg: original.descanso_seg,
      };
    });

    return { exercicios: adaptados, avisos: resultado.avisos || [] };
  } catch {
    return { exercicios, avisos: [] };
  }
}
