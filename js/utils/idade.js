// Cálculo de idade a partir de data de nascimento.
// Cópia equivalente existe em api/coach.js (CommonJS não permite import).
// Usa new Date(ano, mes, dia) em vez de new Date(string) para evitar
// o bug de timezone: strings ISO são interpretadas como UTC, o que
// em fusos negativos desloca a data um dia para trás no getDate().
export function calcularIdade(dataNascimentoStr) {
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
