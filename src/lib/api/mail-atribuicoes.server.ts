import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehPessoal, type Pessoal } from "@/lib/mail/enderecos";
import { schemaMessageId } from "@/lib/mail/validacao";
import { LIMITE_ATRIBUIDOS_NA_BUSCA } from "@/lib/mail/visoes";

/**
 * "Atribuir a…": quem ficou com cada e-mail.
 *
 * A caixa continua só na Hostinger; aqui fica apenas o par Message-ID →
 * pessoa. Message-ID e não UID porque UID muda se a mensagem trocar de pasta
 * (ou se a Hostinger recriar a caixa), e o Message-ID viaja com a mensagem.
 *
 * Só service_role escreve (a tabela não tem política de escrita), e quem
 * chama estas funções já passou por `exigirAdmin`.
 */

/**
 * Os Message-IDs atribuídos à pessoa, mais recentes primeiro, até o teto que
 * cabe numa busca IMAP. Erro sobe: a visão da pessoa sem as atribuições dela
 * esconderia trabalho calado — melhor a tela dizer que não abriu.
 */
export async function idsAtribuidosA(pessoa: Pessoal): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("mail_atribuicoes")
    .select("message_id")
    .eq("responsavel", pessoa)
    .order("atribuido_em", { ascending: false })
    .limit(LIMITE_ATRIBUIDOS_NA_BUSCA);
  if (error) throw new Error(`mail_atribuicoes: ${error.message}`);
  return (data ?? []).map((r) => r.message_id);
}

/** Message-ID → pessoa, para as etiquetas "com Taís" da lista e do leitor. */
export async function atribuicoesDe(ids: string[]): Promise<Map<string, Pessoal>> {
  const mapa = new Map<string, Pessoal>();
  // Os ids da lista vêm do envelope, sem validação: um Message-ID torto (com
  // aspas ou barra invertida) quebraria o filtro `in` do PostgREST e derrubaria a
  // lista inteira. Fora do formato, não pode estar na tabela mesmo (CHECK).
  const unicos = [...new Set(ids)].filter((id) => schemaMessageId.safeParse(id).success);
  if (unicos.length === 0) return mapa;
  const { data, error } = await supabaseAdmin
    .from("mail_atribuicoes")
    .select("message_id, responsavel")
    .in("message_id", unicos);
  if (error) throw new Error(`mail_atribuicoes: ${error.message}`);
  for (const r of data ?? []) {
    // O CHECK da tabela já garante; conferir de novo custa nada e mantém o
    // tipo honesto se alguém mexer na tabela pelo SQL Editor.
    if (ehPessoal(r.responsavel)) mapa.set(r.message_id, r.responsavel);
  }
  return mapa;
}

/** Grava, troca ou (com `null`) remove a atribuição de um Message-ID. */
export async function gravarAtribuicao(
  messageId: string,
  responsavel: Pessoal | null,
  userId: string,
): Promise<void> {
  const { error } = responsavel
    ? await supabaseAdmin.from("mail_atribuicoes").upsert(
        {
          message_id: messageId,
          responsavel,
          atribuido_por: userId,
          atribuido_em: new Date().toISOString(),
        },
        { onConflict: "message_id" },
      )
    : await supabaseAdmin.from("mail_atribuicoes").delete().eq("message_id", messageId);
  if (error) throw new Error(`mail_atribuicoes: ${error.message}`);
}
