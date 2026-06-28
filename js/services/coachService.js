export async function perguntarCoach(pergunta, session) {
  const resp = await fetch('/api/coach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ pergunta }),
  });
  if (!resp.ok) throw new Error(`Erro ${resp.status} ao contactar o coach`);
  const dados = await resp.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados.sugestao;
}
