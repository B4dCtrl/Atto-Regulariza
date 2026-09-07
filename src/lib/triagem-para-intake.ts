/**
 * O que a triagem já respondeu, no vocabulário do wizard.
 *
 * As duas telas perguntam a mesma coisa com palavras diferentes: a triagem diz
 * `nunca_averbada`, o wizard diz `sem_habite`. Sem esta tradução a pessoa
 * responderia tudo de novo depois de já ter respondido no WhatsApp — e
 * desistiria, com razão.
 *
 * O que não dá para traduzir fica **em branco de propósito**, para o wizard
 * perguntar. Preencher com chute seria pior que perguntar: o cadastro erraria
 * calado, e o erro só apareceria na análise.
 */

import type { Respostas } from "./triagem";

/** Os campos do wizard que conseguimos deduzir. */
export type IntakeParcial = {
  tipo_imovel: string;
  tem_escritura: string;
  situacao: string;
  cidade: string;
  estado: string;
  area_m2: string;
  objetivo: string;
  nome: string;
};

const VAZIO: IntakeParcial = {
  tipo_imovel: "",
  tem_escritura: "",
  situacao: "",
  cidade: "",
  estado: "",
  area_m2: "",
  objetivo: "",
  nome: "",
};

/** A triagem e o wizard usam os mesmos identificadores de tipo. */
const TIPOS = new Set(["casa", "apartamento", "terreno", "comercial"]);

const AREA: Record<string, string> = {
  ate_70: "até 70",
  "70_150": "70 a 150",
  "150_300": "150 a 300",
  mais_300: "mais de 300",
};

const OBJETIVO: Record<string, string> = {
  vender: "Quero vender o imóvel",
  heranca: "Deixar em ordem para herança",
  regularizar: "Regularizar para uso pessoal",
  // "Recebi notificação" não tem equivalente na lista do wizard. Em branco: a
  // pessoa escolhe, e a equipe já sabe do prazo pelo relato da triagem.
  notificacao: "",
};

/** Situação quando a matrícula existe. */
const COM_REGISTRO: Record<string, string> = {
  nunca_averbada: "sem_habite",
  ampliacao: "sem_habite",
  area_nao_bate: "retificacao",
  nao_sei: "",
};

export function intakeDaTriagem(r: Partial<Respostas>): IntakeParcial {
  const saida = { ...VAZIO };

  if (r.imovel && TIPOS.has(r.imovel)) saida.tipo_imovel = r.imovel;
  if (r.cidade) saida.cidade = r.cidade;
  if (r.nome) saida.nome = r.nome;
  if (r.area) saida.area_m2 = AREA[r.area] ?? "";
  if (r.motivo) saida.objetivo = OBJETIVO[r.motivo] ?? "";

  // Contrato de gaveta é o único caso em que a triagem afirma que NÃO há
  // registro. "Em outro nome" ainda é uma matrícula existente — o problema
  // dali é de titularidade, não de ausência de documento.
  if (r.matricula === "propria" || r.matricula === "outro_nome") saida.tem_escritura = "sim";
  else if (r.matricula === "gaveta") saida.tem_escritura = "nao";

  // Herança define o caminho inteiro: antes de mexer na construção, o imóvel
  // precisa passar aos herdeiros. Por isso vence a divergência declarada.
  if (r.motivo === "heranca") {
    saida.situacao = saida.tem_escritura === "nao" ? "heranca_s_doc" : "heranca";
  } else if (saida.tem_escritura === "nao") {
    saida.situacao = "sem_escritura";
  } else if (saida.tem_escritura === "sim" && r.divergencia) {
    saida.situacao = COM_REGISTRO[r.divergencia] ?? "";
  }

  return saida;
}
