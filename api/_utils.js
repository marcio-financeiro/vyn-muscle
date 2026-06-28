// api/_utils.js — funções utilitárias compartilhadas entre handlers CommonJS
// (não é possível importar ES Modules de handlers Vercel)

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

function diaAnterior(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

module.exports = { calcularIdade, diaAnterior };
