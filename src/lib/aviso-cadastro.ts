/**
 * O que vai no WhatsApp da equipe quando um cliente termina o cadastro.
 *
 * Lógica pura, separada do envio, para ser testada sem rede. Os valores
 * entram no modelo `novo_cadastro` da Meta na ordem {{1}}…{{5}}: trocar a
 * ordem aqui exige trocar lá, e vice-versa.
 */

/** Os ids que o wizard grava em `properties`, no texto que a equipe lê. */
const TIPO: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
  comercial: "Sala comercial",
  rural: "Imóvel rural",
  outro: "Imóvel",
};

const SITUACAO: Record<string, string> = {
  matricula_pendencia: "Matrícula com pendências",
  sem_habite: "Sem habite-se / averbação",
  retificacao: "Retificação de área",
  heranca: "Herança / inventário",
  sem_escritura: "Nunca teve escritura",
  escritura_velha: "Escritura antiga não registrada",
  usucapiao: "Usucapião",
  heranca_s_doc: "Herança sem documentação",
  outro: "Outra situação",
};

export type CadastroParaAviso = {
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  tipo_imovel: string | null;
  situacao: string | null;
  objetivo: string | null;
  city: string | null;
  state: string | null;
};

/** Id desconhecido passa como veio: melhor o id cru que esconder o dado. */
function rotulo(mapa: Record<string, string>, id: string | null): string {
  if (!id) return "";
  return mapa[id] ?? id;
}

/** [cliente, imóvel, situação, objetivo, contato] — vazio vira "—" no envio. */
export function valoresDoAviso(p: CadastroParaAviso): string[] {
  const local = [p.city, p.state].filter(Boolean).join("/");
  const tipo = rotulo(TIPO, p.tipo_imovel);
  const imovel = [tipo, local].filter(Boolean).join(" em ");
  const contato = [p.client_phone, p.client_email].filter(Boolean).join(" · ");

  return [p.client_name ?? "", imovel, rotulo(SITUACAO, p.situacao), p.objetivo ?? "", contato];
}

/**
 * O banco chama o aviso na hora em que o imóvel nasce. Um processo mais velho
 * que isto não é cadastro novo: é chamada repetida, ou alguém com a chave
 * tentando reaproveitar um id antigo para disparar mensagens.
 */
export const JANELA_DO_AVISO_MS = 15 * 60 * 1000;

export function cadastroRecente(criadoEm: string, agora = Date.now()): boolean {
  const t = Date.parse(criadoEm);
  return Number.isFinite(t) && agora - t >= -60_000 && agora - t <= JANELA_DO_AVISO_MS;
}
