/**
 * Tipos de documento — fonte única.
 *
 * Usado pelo seletor do cliente, pelo do profissional e pelos rótulos das
 * listagens. Ter um só lugar evita que a lista do seletor e a da exibição
 * divirjam com o tempo.
 */

export type DocumentOrigem = "cliente" | "profissional";

export type DocumentKind =
  | "matricula"
  | "iptu"
  | "identidade"
  | "comprovante_endereco"
  | "planta"
  | "habite_se"
  | "ccir_car"
  | "art_rrt"
  | "laudo"
  | "projeto"
  | "protocolo"
  | "outro";

export const DOCUMENT_KINDS = [
  { kind: "matricula", label: "Matrícula / escritura", origem: "cliente" },
  { kind: "iptu", label: "IPTU atualizado", origem: "cliente" },
  { kind: "identidade", label: "RG e CPF do proprietário", origem: "cliente" },
  { kind: "comprovante_endereco", label: "Comprovante de endereço", origem: "cliente" },
  { kind: "planta", label: "Planta do imóvel", origem: "cliente" },
  { kind: "habite_se", label: "Habite-se", origem: "cliente" },
  { kind: "ccir_car", label: "CCIR / CAR (rural)", origem: "cliente" },
  { kind: "art_rrt", label: "ART / RRT", origem: "profissional" },
  { kind: "laudo", label: "Laudo técnico", origem: "profissional" },
  { kind: "projeto", label: "Projeto técnico", origem: "profissional" },
  { kind: "protocolo", label: "Comprovante de protocolo", origem: "profissional" },
  { kind: "outro", label: "Outro", origem: "cliente" },
] as const satisfies readonly { kind: DocumentKind; label: string; origem: DocumentOrigem }[];

/**
 * O que cada lado pode enviar. O cliente só vê os tipos dele — oferecer
 * "ART / RRT" a quem não emite ART só gera escolha errada.
 * O profissional envia qualquer tipo, inclusive corrigindo documento do cliente.
 */
export function kindsPara(origem: DocumentOrigem) {
  if (origem === "profissional") return DOCUMENT_KINDS;
  return DOCUMENT_KINDS.filter((k) => k.origem === "cliente");
}

export function rotuloDoKind(kind: string): string {
  return DOCUMENT_KINDS.find((k) => k.kind === kind)?.label ?? "Documento";
}
