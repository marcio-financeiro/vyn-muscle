// api/montar-sessao.js
const { createClient } = require('@supabase/supabase-js');
const { calcularIdade, diaAnterior } = require('./_utils.js');

function normalizar(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

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

  const hoje = new Date().toISOString().slice(0, 10);

  // 1. Checar check-in
  const { data: checkin } = await supabase
    .from('checkins_diarios')
    .select('*')
    .eq('user_id', user.id)
    .eq('data', hoje)
    .maybeSingle();

  if (!checkin) return res.status(200).json({ precisa_checkin: true });

  // 2. Checar plano ativo
  const { data: plano } = await supabase
    .from('planos_treino')
    .select('*')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plano) return res.status(200).json({ precisa_plano: true });

  // 3. Checar cache (sessão já gerada hoje)
  const { data: sessaoCache } = await supabase
    .from('sessoes_diarias')
    .select('*')
    .eq('user_id', user.id)
    .eq('data', hoje)
    .maybeSingle();

  if (sessaoCache) {
    return res.status(200).json({
      exercicios: sessaoCache.exercicios,
      avisos: sessaoCache.avisos,
      sessao_id: sessaoCache.id,
      fonte: 'cache',
      plano: { id: plano.id, foco_id: plano.foco_id, tipo: plano.tipo },
    });
  }

  // 4. Construir sessão
  let exerciciosDoDia = [];
  let avisos = [];

  if (plano.tipo === 'ia_personalizada') {
    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    const resultado = await gerarSessaoIA(perfil, checkin);
    exerciciosDoDia = resultado.exercicios;
    avisos = resultado.avisos;
  } else {
    // catalogo: montar pelo pool de exercícios do plano
    const todos = plano.exercicios_efetivos || [];

    if (plano.modo === 'fixo') {
      exerciciosDoDia = todos;
    } else {
      // variado: âncoras fixas + subset rotativo de variáveis
      const ancoras   = todos.filter(e => normalizar(e.tipo) === 'ancora' || normalizar(e.tipo) === 'bloco');
      const variaveis = todos.filter(e => normalizar(e.tipo) === 'variavel');

      const { data: sessaoOntem } = await supabase
        .from('sessoes_diarias')
        .select('exercicios')
        .eq('user_id', user.id)
        .eq('data', diaAnterior(hoje))
        .maybeSingle();

      const nomesOntem = new Set(
        (sessaoOntem?.exercicios || [])
          .filter(e => normalizar(e.tipo) === 'variavel')
          .map(e => e.nome)
      );

      const variaveisOrdenadas = [
        ...variaveis.filter(e => !nomesOntem.has(e.nome)),
        ...variaveis.filter(e =>  nomesOntem.has(e.nome)),
      ];

      const numVar = Math.min(3, variaveisOrdenadas.length);
      exerciciosDoDia = [...ancoras, ...variaveisOrdenadas.slice(0, numVar)];
    }

    // Ajustes determinísticos pelo check-in
    if (checkin.tempo_disponivel_min && checkin.tempo_disponivel_min < 40) {
      const ancoras    = exerciciosDoDia.filter(e => normalizar(e.tipo) === 'ancora' || normalizar(e.tipo) === 'bloco');
      const primeiraVar = exerciciosDoDia.find(e => normalizar(e.tipo) === 'variavel');
      exerciciosDoDia = primeiraVar ? [...ancoras, primeiraVar] : ancoras;
    }

    if (checkin.dormiu_bem === false) {
      exerciciosDoDia = exerciciosDoDia.map(e => {
        if (normalizar(e.tipo) === 'bloco') return e;
        return { ...e, series: Math.max(2, (e.series || 3) - 1) };
      });
    }
  }

  // Aviso de dor (sempre, independente de tipo de plano)
  if (checkin.teve_dor) {
    const local = checkin.dor_local ? ` em ${checkin.dor_local}` : '';
    avisos.unshift(`Você reportou dor${local} hoje. Avalie cada exercício — reduza a carga ou pule se sentir desconforto.`);
  }

  // 5. Salvar sessão gerada
  if (!exerciciosDoDia.length) {
    console.error('[montar-sessao] exercicios vazio — plano_id:', plano.id, 'tipos:', (plano.exercicios_efetivos || []).map(e => e.tipo));
    return res.status(500).json({ erro: 'Nenhum exercício encontrado para o foco ativo. Escolha um novo foco.' });
  }

  const { data: novaSessao, error: sessaoError } = await supabase
    .from('sessoes_diarias')
    .insert({
      user_id: user.id,
      plano_id: plano.id,
      data: hoje,
      exercicios: exerciciosDoDia,
      avisos,
    })
    .select()
    .single();

  if (sessaoError) return res.status(500).json({ erro: 'Erro ao salvar sessão' });

  return res.status(200).json({
    exercicios: novaSessao.exercicios,
    avisos: novaSessao.avisos,
    sessao_id: novaSessao.id,
    fonte: 'gerada',
    plano: { id: plano.id, foco_id: plano.foco_id, tipo: plano.tipo },
  });
};

async function gerarSessaoIA(perfil, checkin) {
  if (!process.env.ANTHROPIC_API_KEY) return { exercicios: [], avisos: ['IA não disponível.'] };

  const idadeStr = perfil?.data_nascimento
    ? `${calcularIdade(perfil.data_nascimento)} anos`
    : 'idade não informada';
  const tempoStr  = checkin.tempo_disponivel_min ? `${checkin.tempo_disponivel_min} minutos` : 'tempo não informado';
  const dormioStr = checkin.dormiu_bem === false ? 'dormiu mal' : 'dormiu bem';
  const dorStr    = checkin.teve_dor
    ? `tem dor${checkin.dor_local ? ` em ${checkin.dor_local}` : ''}`
    : 'sem dor';

  const prompt = `Coach de musculação. Monte uma sessão personalizada.

Perfil: ${idadeStr}, objetivo: ${perfil?.objetivo || 'não informado'}, experiência: ${perfil?.experiencia || 'não informada'}, local: ${perfil?.local_treino || 'academia'}, equipamentos: ${perfil?.equipamentos || 'padrão academia'}.
Restrições: ${perfil?.restricoes || 'nenhuma'}.
Check-in: ${dormioStr}, ${dorStr}, ${tempoStr} disponíveis.

Monte a sessão adequada ao tempo e ao estado físico de hoje.
${perfil?.restricoes ? 'Se a restrição for lesão grave, inclua aviso de liberação médica nos avisos.' : ''}

Responda APENAS em JSON válido, sem texto antes ou depois:
{"exercicios":[{"nome":"string","tipo":"ia","series":3,"reps_min":8,"reps_max":12,"descanso_seg":60}],"avisos":["string"]}`;

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

    if (!resp.ok) return { exercicios: [], avisos: ['Erro ao gerar sessão personalizada.'] };

    const dados = await resp.json();
    const texto = dados.content?.[0]?.text ?? '';
    const limpo = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const resultado = JSON.parse(limpo);
    return { exercicios: resultado.exercicios || [], avisos: resultado.avisos || [] };
  } catch {
    return { exercicios: [], avisos: ['Erro ao processar sessão personalizada.'] };
  }
}
