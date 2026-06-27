const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return res.status(500).json({ erro: 'Variáveis de ambiente do Supabase não configuradas no Vercel' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada no Vercel' });
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

  const { data: logs, error: logsError } = await supabase
    .from('treino_logs')
    .select('*')
    .order('data', { ascending: false })
    .limit(60);

  if (logsError) {
    return res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }

  if (!logs || logs.length === 0) {
    return res.status(200).json({ insights: [] });
  }

  const porExercicio = {};
  for (const log of logs) {
    if (!porExercicio[log.exercicio]) porExercicio[log.exercicio] = [];
    porExercicio[log.exercicio].push(log);
  }

  const prompt = montarPrompt(porExercicio);

  const respostaIA = await fetch('https://api.anthropic.com/v1/messages', {
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

  if (!respostaIA.ok) {
    const erroTexto = await respostaIA.text();
    return res.status(500).json({ erro: 'Erro ao consultar a IA', detalhe: erroTexto.slice(0, 200) });
  }

  const dadosIA = await respostaIA.json();
  const textoIA = dadosIA.content?.[0]?.text ?? '';

  // Remove bloco markdown se a IA devolver ```json ... ```
  const textoLimpo = textoIA.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let insights;
  try {
    insights = JSON.parse(textoLimpo);
  } catch {
    return res.status(500).json({ erro: 'Resposta da IA em formato inesperado', raw: textoLimpo.slice(0, 300) });
  }

  return res.status(200).json({ insights });
};

function montarPrompt(porExercicio) {
  const resumo = Object.entries(porExercicio)
    .map(([exercicio, sessoes]) => {
      const linhas = sessoes
        .slice(0, 5)
        .map(s =>
          `${s.data}: ${s.series ?? '?'}x${s.reps ?? '?'} @ ${s.carga ?? '?'}kg, RPE ${s.rpe ?? 'não informado'}${s.obs ? `, obs: ${s.obs}` : ''}`
        )
        .join('\n');
      return `## ${exercicio}\n${linhas}`;
    })
    .join('\n\n');

  return `Você é um coach de musculação analisando o histórico de treino de um usuário.

Histórico recente por exercício:

${resumo}

Para cada exercício com pelo menos 2 sessões registradas, gere uma sugestão curta e prática de ajuste de carga, volume ou progressão, baseada na tendência de carga e RPE ao longo das sessões.

Responda APENAS em JSON, sem nenhum texto antes ou depois, no formato exato:
[
  { "exercicio": "nome", "tendencia": "subindo", "anotacao": "sugestão curta, até 2 frases" }
]

O campo "tendencia" deve ser um destes três valores: "subindo", "estavel" ou "caindo".

Se não houver pelo menos 2 sessões de um exercício, não o inclua na lista. Se nenhum exercício tiver dados suficientes, responda com um array vazio: []`;
}
