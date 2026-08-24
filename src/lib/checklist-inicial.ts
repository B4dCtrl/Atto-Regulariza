import { rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";

/**
 * O checklist do protocolo inicial e a regra da trava.
 *
 * Funções puras, num arquivo só: a mesma resposta é precisa na tela do cliente
 * (o que ainda falta enviar), na do admin (o caso pode ser delegado?) e no
 * texto do erro do banco. Espalhar essa conta por três lugares garantiria que
 * um deles ficaria para trás.
 */

/** Os três que o cliente envia logo após o tutorial. */
export const CHECKLIST_PADRAO = [
  "identidade",
  "comprovante_endereco",
  "matricula",
] as const satisfies readonly DocumentKind[];

/**
 * Os que travam a delegação.
 *
 * Matrícula fica de fora de propósito: metade de quem procura regularização
 * não tem matrícula — é por isso que procura. Exigi-la para delegar deixaria
 * justamente esses casos parados sem o profissional que sabe resolvê-los.
 */
export const KINDS_ESSENCIAIS = [
  "identidade",
  "comprovante_endereco",
] as const satisfies readonly DocumentKind[];

export type DocumentoResumo = {
  kind: string;
  status: string;
  deleted_at: string | null;
};

/** Documento excluído não conta para nada. */
function vivos(docs: DocumentoResumo[]): DocumentoResumo[] {
  return docs.filter((d) => d.deleted_at === null);
}

/**
 * O que ainda falta do checklist padrão.
 *
 * Mede ENVIO, não aprovação: quem enviou fez a parte dele e não deve continuar
 * vendo o item como pendente enquanto a equipe confere.
 */
export function faltamDoChecklist(docs: DocumentoResumo[]): DocumentKind[] {
  const enviados = new Set(vivos(docs).map((d) => d.kind));
  return CHECKLIST_PADRAO.filter((k) => !enviados.has(k));
}

/** Os dois essenciais estão aprovados? É a regra da trava de delegação. */
export function essenciaisAprovados(docs: DocumentoResumo[]): boolean {
  const aprovados = new Set(
    vivos(docs)
      .filter((d) => d.status === "Aprovado")
      .map((d) => d.kind),
  );
  return KINDS_ESSENCIAIS.every((k) => aprovados.has(k));
}

/** Rótulos legíveis, para mensagem de tela. */
export function rotulosDe(kinds: DocumentKind[]): string {
  return kinds.map(rotuloDoKind).join(", ");
}
