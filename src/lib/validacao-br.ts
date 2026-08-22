/**
 * Validação de dados brasileiros.
 *
 * Os formulários de cadastro aceitavam qualquer coisa nos campos: bastava não
 * estar vazio. CPF é o caso mais grave — ele identifica a pessoa no cartório e
 * na prefeitura, e um dígito errado só aparece semanas depois, quando o órgão
 * devolve o processo.
 *
 * Validar aqui não substitui validar no servidor. É a primeira barreira, a que
 * evita o erro de digitação; a segunda continua sendo a regra no banco.
 */

/** DDDs que existem no Brasil. Fora desta lista, o telefone é digitação errada. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Só os dígitos, descartando pontuação. */
function digitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Calcula um dígito verificador do CPF.
 *
 * O peso começa em `pesoInicial` e decresce a cada posição. Para o primeiro
 * dígito são 9 números com pesos 10..2; para o segundo, 10 números com 11..2.
 */
function digitoVerificador(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += Number(base[i]) * (pesoInicial - i);
  }
  const resto = (soma * 10) % 11;
  // Resto 10 vale 0 — é a regra da Receita, e a razão de CPFs terminados em
  // zero existirem.
  return resto === 10 ? 0 : resto;
}

/**
 * Diz se um CPF é matematicamente válido.
 *
 * Válido não é o mesmo que existente: a conta confere, mas só a Receita sabe se
 * o número foi emitido. Serve para pegar digitação errada, não fraude.
 */
export function validarCPF(valor: string): boolean {
  // Letra no meio não pode ser simplesmente ignorada: "529.982.24a-25" tem 10
  // dígitos e viraria outro CPF se a letra sumisse em silêncio.
  if (/[^\d.\-\s]/.test(valor)) return false;

  const num = digitos(valor);
  if (num.length !== 11) return false;

  // Todos iguais passam na conta dos dígitos verificadores, mas nenhum foi
  // emitido. É a recusa que precisa vir antes do cálculo.
  if (/^(\d)\1{10}$/.test(num)) return false;

  if (digitoVerificador(num.slice(0, 9), 10) !== Number(num[9])) return false;
  if (digitoVerificador(num.slice(0, 10), 11) !== Number(num[10])) return false;

  return true;
}

/**
 * Põe a pontuação do CPF conforme se digita, e não deixa passar de 11 dígitos.
 *
 * Aceita entrada parcial de propósito: é usada no `onChange` do campo, então
 * precisa devolver algo coerente a cada tecla.
 */
export function formatarCPF(valor: string): string {
  const num = digitos(valor).slice(0, 11);
  if (num.length <= 3) return num;
  if (num.length <= 6) return `${num.slice(0, 3)}.${num.slice(3)}`;
  if (num.length <= 9) return `${num.slice(0, 3)}.${num.slice(3, 6)}.${num.slice(6)}`;
  return `${num.slice(0, 3)}.${num.slice(3, 6)}.${num.slice(6, 9)}-${num.slice(9)}`;
}

/**
 * Verificação de formato de e-mail.
 *
 * Deliberadamente simples. A regra completa da RFC 5322 aceita coisas que
 * nenhum provedor entrega, e recusar endereço legítimo é pior que aceitar um
 * inexistente — quem confirma de verdade é o e-mail de confirmação.
 */
export function validarEmail(valor: string): boolean {
  const v = valor.trim();
  if (v.length === 0 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Telefone brasileiro: DDD válido mais 8 (fixo) ou 9 (celular) dígitos. */
export function validarTelefone(valor: string): boolean {
  const num = digitos(valor);
  if (num.length !== 10 && num.length !== 11) return false;
  if (!DDDS.has(Number(num.slice(0, 2)))) return false;
  // Celular tem 11 dígitos e sempre começa com 9 depois do DDD.
  if (num.length === 11 && num[2] !== "9") return false;
  return true;
}

/** Põe a pontuação do telefone conforme se digita. */
export function formatarTelefone(valor: string): string {
  const num = digitos(valor).slice(0, 11);
  if (num.length <= 2) return num;
  if (num.length <= 6) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
  if (num.length <= 10) return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`;
  return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
}
