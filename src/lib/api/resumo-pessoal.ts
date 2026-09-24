/**
 * "O que é seu": a frase de abertura do resumo pessoal do admin.
 *
 * Sem IA, de propósito: são duas contagens (e-mails não lidos e processos
 * atribuídos) e uma saudação. Escrever isso com um modelo custaria uma
 * chamada por admin por abertura para dizer o que um `if` diz — e mandaria
 * dado pessoal para fora sem necessidade.
 *
 * Funções puras: o plural, o zero e o fuso são o tipo de coisa que quebra
 * calado, e aqui têm teste.
 */

import { ehEndereco, type Endereco } from "@/lib/mail/enderecos";

/**
 * O dono: o único login que conta os não lidos da caixa INTEIRA.
 *
 * Os outros admins entram com o alias deles (tais@, gabriel@…) e contam só o
 * que chegou para eles. Qualquer outro e-mail — um admin futuro sem alias,
 * por exemplo — não conta nada: a caixa inteira é informação do dono, e na
 * dúvida o cartão mostra "indisponível".
 */
export const EMAIL_DONO = "ozanchet@gmail.com";

/** Qual caixa contar para este login: um alias, a inteira ou nenhuma. */
export function caixaDoAdmin(email: string | null | undefined): Endereco | "inteira" | null {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  if (ehEndereco(e)) return e;
  if (e === EMAIL_DONO) return "inteira";
  return null;
}

export type ProcessoPessoal = {
  id: string;
  nome: string;
  etapa: number;
  /** Dias inteiros desde a última movimentação. */
  diasParado: number;
  /** Passou de `DIAS_PARADO` — a mesma régua do painel gerencial. */
  parado: boolean;
};

/** Hora cheia em São Paulo, para "bom dia" bater com o relógio do admin. */
function horaSP(agora: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hourCycle: "h23",
  }).format(agora);
  return Number(h);
}

export function cumprimento(agora: Date): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = horaSP(agora);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Primeiro nome do perfil; sem perfil, o rótulo do alias; sem os dois, nada. */
export function primeiroNome(nome: string | null, rotuloAlias: string | null): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0];
  if (primeiro) return primeiro;
  return rotuloAlias?.trim() || null;
}

/** "a", "a e b", "a, b e c". */
function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

function frasesDeProcessos(processos: ProcessoPessoal[]): string[] {
  const partes: string[] = [];

  const andando = processos.filter((p) => !p.parado).length;
  if (andando > 0) {
    partes.push(andando === 1 ? "1 processo em andamento" : `${andando} processos em andamento`);
  }

  const parados = processos.filter((p) => p.parado);
  if (parados.length === 1) {
    partes.push(`1 processo parado há ${dias(parados[0].diasParado)}`);
  } else if (parados.length > 1) {
    const maisAntigo = Math.max(...parados.map((p) => p.diasParado));
    partes.push(`${parados.length} processos parados, o mais antigo há ${dias(maisAntigo)}`);
  }

  return partes;
}

/**
 * "Boa tarde, Taís. Você tem 3 e-mails não lidos e 1 processo parado há 9 dias."
 *
 * `naoLidos` nulo = a caixa não respondeu. Aí a frase fala só dos processos;
 * dizer "nenhum e-mail" seria afirmar o que não se sabe. A tela mostra
 * "indisponível" ao lado.
 */
export function montarSaudacao(p: {
  agora: Date;
  nome: string | null;
  naoLidos: number | null;
  processos: ProcessoPessoal[];
}): string {
  const abertura = p.nome ? `${cumprimento(p.agora)}, ${p.nome}.` : `${cumprimento(p.agora)}.`;

  const partes: string[] = [];
  if (p.naoLidos !== null && p.naoLidos > 0) {
    partes.push(p.naoLidos === 1 ? "1 e-mail não lido" : `${p.naoLidos} e-mails não lidos`);
  }
  partes.push(...frasesDeProcessos(p.processos));

  if (partes.length > 0) return `${abertura} Você tem ${juntar(partes)}.`;
  if (p.naoLidos === null) return `${abertura} Nenhum processo com você agora.`;
  return `${abertura} Nada pendente com você agora.`;
}
