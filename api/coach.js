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

  const [{ data: logs, error: logsError }, { data: perfil }] = await Promise.all([
    supabase
      .from('treino_logs')
      .select('*')
      .order('data', { ascending: false })
      .limit(60),
    supabase
      .from('perfis')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (logsError) {
    return res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }

  const { pergunta } = req.body || {};

  if (pergunta) {
    const contexto = montarContextoTexto(logs || []);
    const perfilTexto = montarPerfilTexto(perfil);
    const respostaIA = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Você é um coach de musculação. Use o perfil e o histórico abaixo para responder à pergunta. Seja direto e prático, máximo 3 frases.\n\n${perfilTexto}\n\nHistórico:\n${contexto}\n\nPergunta: ${pergunta}`,
        }],
      }),
    });
    if (!respostaIA.ok) {
      return res.status(500).json({ erro: 'Erro ao consultar a IA' });
    }
    const dadosIA = await respostaIA.json();
    const sugestao = dadosIA.content?.[0]?.text?.trim() ?? '';
    return res.status(200).json({ sugestao });
  }

  if (!logs || logs.length === 0) {
    return res.status(200).json({ insights: [] });
  }

  const porExercicio = {};
  for (const log of logs) {
    if (!porExercicio[log.exercicio]) porExercicio[log.exercicio] = [];
    porExercicio[log.exercicio].push(log);
  }

  const prompt = montarPrompt(porExercicio, perfil);

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

// Cópia de js/utils/idade.js — CommonJS não permite import de ES modules.
// Usa new Date(ano, mes, dia) para evitar bug de timezone com strings ISO.
function calcularIdade(dataNascimentoStr) {
  if (!dataNascimentoStr) return null;
  const hoje = new Date();
  const [ano, mes, dia] = dataNascimentoStr.split('-').map(Number);
  const nascimento = new Date(ano, mes - 1, dia);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade--;
  return idade;
}

function montarPerfilTexto(perfil) {
  if (!perfil) return '';
  const partes = [];
  if (perfil.data_nascimento) {
    const idade = calcularIdade(perfil.data_nascimento);
    if (idade !== null) partes.push(`${idade} anos`);
  }
  if (perfil.sexo)                    partes.push(`sexo: ${perfil.sexo}`);
  if (perfil.altura_cm)               partes.push(`${perfil.altura_cm}cm`);
  if (perfil.peso_kg)                 partes.push(`${perfil.peso_kg}kg`);
  if (perfil.objetivo)                partes.push(`objetivo: ${perfil.objetivo}`);
  if (perfil.experiencia)             partes.push(`experiência: ${perfil.experiencia}`);
  if (perfil.disponibilidade_semanal) partes.push(`treina ${perfil.disponibilidade_semanal}x/semana`);
  if (perfil.duracao_sessao_min)      partes.push(`sessões de ${perfil.duracao_sessao_min} min`);
  if (perfil.local_treino)            partes.push(`local: ${perfil.local_treino}`);
  if (perfil.equipamentos)            partes.push(`equipamentos: ${perfil.equipamentos}`);
  if (perfil.restricoes)              partes.push(`restrições: ${perfil.restricoes}`);
  if (perfil.peso_objetivo_kg) {
    const metaStr = perfil.peso_kg
      ? `meta de peso: ${perfil.peso_objetivo_kg}kg (atual: ${perfil.peso_kg}kg)`
      : `meta de peso: ${perfil.peso_objetivo_kg}kg`;
    partes.push(metaStr);
  }
  return partes.length ? `Perfil do usuário: ${partes.join(', ')}.` : '';
}

function montarContextoTexto(logs) {
  if (!logs.length) return 'Nenhum treino registrado ainda.';
  return logs
    .slice(0, 20)
    .map(s =>
      `${s.data} — ${s.exercicio}: ${s.series ?? '?'}x${s.reps ?? '?'} @ ${s.carga ?? '?'}kg, RPE ${s.rpe ?? 'não informado'}${s.obs ? `, obs: ${s.obs}` : ''}`
    )
    .join('\n');
}

function montarPrompt(porExercicio, perfil) {
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

  const perfilTexto = montarPerfilTexto(perfil);
  const cabecalhoPerfil = perfilTexto ? `\n${perfilTexto}\n` : '';

  return `Você é um coach de musculação analisando o histórico de treino de um usuário.${cabecalhoPerfil}

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
