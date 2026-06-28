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

  const { focoIds, tipo = 'catalogo', modo = 'variado' } = req.body || {};

  let focos = [];
  let avisos = [];

  if (tipo === 'catalogo') {
    if (!focoIds?.length) return res.status(400).json({ erro: 'focoIds obrigatório para tipo catalogo' });

    // Busca todos os focos de uma vez
    const { data: focosData, error: focosError } = await supabase
      .from('focos_treino')
      .select('*')
      .in('id', focoIds);

    if (focosError || !focosData?.length) return res.status(400).json({ erro: 'Foco não encontrado' });

    // Reordena para respeitar a ordem escolhida pelo usuário
    const focosMap = Object.fromEntries(focosData.map(f => [f.id, f]));
    const focosOrdenados = focoIds.map(id => focosMap[id]).filter(Boolean);

    // Busca restrições do perfil
    const { data: perfil } = await supabase
      .from('perfis')
      .select('restricoes')
      .eq('user_id', user.id)
      .maybeSingle();

    if (perfil?.restricoes) {
      // Uma única chamada de IA para todos os focos selecionados
      const resultado = await adaptarTodosPorRestricao(focosOrdenados, perfil.restricoes);
      focos = resultado.focos;
      avisos = resultado.avisos;
    } else {
      focos = focosOrdenados.map(f => ({
        foco_id: f.id,
        nome: f.nome,
        exercicios_efetivos: f.exercicios,
      }));
    }
  }
  // ia_personalizada: focos = [] — exercícios gerados em /api/montar-sessao

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
    .insert({ user_id: user.id, tipo, modo, focos, ativo: true })
    .select()
    .single();

  if (planoError) return res.status(500).json({ erro: 'Erro ao salvar plano' });

  return res.status(200).json({ plano: novoPlano, avisos });
};

async function adaptarTodosPorRestricao(focosOrdenados, restricoes) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      focos: focosOrdenados.map(f => ({
        foco_id: f.id, nome: f.nome, exercicios_efetivos: f.exercicios,
      })),
      avisos: [],
    };
  }

  const focosStr = focosOrdenados.map((f, i) => {
    const lista = f.exercicios
      .filter(e => e.tipo !== 'bloco')
      .map(e => `    - ${e.nome} (${e.tipo})`)
      .join('\n');
    return `Foco ${i}: "${f.nome}"\n${lista || '    (sem exercícios adaptáveis)'}`;
  }).join('\n\n');

  const prompt = `Você é um personal trainer. O usuário tem: "${restricoes}".

Para cada foco abaixo, substitua exercícios que conflitem com a restrição mantendo o mesmo tipo (ancora/variavel).
Se a restrição for lesão grave (cirurgia, ruptura, hérnia), inclua aviso de liberação médica.

${focosStr}

Responda APENAS em JSON válido, sem texto antes ou depois:
{"focos":[{"exercicios":[/* mesmos campos originais, nome substituído onde necessário */]}],"avisos":["string"]}

O array "focos" deve ter exatamente ${focosOrdenados.length} elemento(s), na mesma ordem dos focos acima.`;

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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error('API error');

    const dados = await resp.json();
    const texto = dados.content?.[0]?.text ?? '';
    const limpo = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const resultado = JSON.parse(limpo);

    const focos = focosOrdenados.map((focoOriginal, i) => {
      const aiExercicios = resultado.focos?.[i]?.exercicios || focoOriginal.exercicios;
      const adaptados = aiExercicios.map((aiEx, j) => {
        const original = focoOriginal.exercicios[j] || {};
        return {
          nome:         aiEx.nome ?? original.nome,
          tipo:         original.tipo,
          series:       original.series,
          reps_min:     original.reps_min,
          reps_max:     original.reps_max,
          descanso_seg: original.descanso_seg,
          duracao_min:  original.duracao_min,
          intensidade:  original.intensidade,
        };
      });
      return { foco_id: focoOriginal.id, nome: focoOriginal.nome, exercicios_efetivos: adaptados };
    });

    return { focos, avisos: resultado.avisos || [] };
  } catch {
    return {
      focos: focosOrdenados.map(f => ({
        foco_id: f.id, nome: f.nome, exercicios_efetivos: f.exercicios,
      })),
      avisos: [],
    };
  }
}
