/**
 * Pedidos de aprovação do admin.
 *
 * A regra é imposta por gatilho no banco: concluir processo e excluir
 * documento falham sem pedido aprovado. Estas funções só criam e decidem o
 * pedido — não são elas que garantem a regra, e é por isso que a garantia
 * sobrevive a qualquer chamada direta à API.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Aprovacao = Tables<"approval_requests">;
export type TipoAprovacao = "conclusao" | "exclusao_documento";

export async function pedirAprovacao(p: {
  propertyId: string;
  tipo: TipoAprovacao;
  documentId?: string;
  justificativa?: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("approval_requests").insert({
    property_id: p.propertyId,
    tipo: p.tipo,
    document_id: p.documentId ?? null,
    justificativa: p.justificativa ?? null,
    solicitado_por: user?.id ?? null,
  });

  if (error) throw new Error("Não foi possível enviar o pedido.");
}

/**
 * Pedidos ainda por decidir.
 *
 * Sem filtro de papel na consulta: a RLS de approval_requests só devolve os
 * processos que o usuário gerencia, e o admin passa por `is_admin()` dentro
 * de `pode_gerenciar_processo`. Um profissional que chame isto vê apenas os
 * pedidos dos processos dele — inclusive os que ele mesmo abriu.
 */
export async function listarAprovacoesPendentes(): Promise<Aprovacao[]> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pendente")
    .order("solicitado_em", { ascending: false });

  if (error) throw new Error("Não foi possível carregar os pedidos.");
  return data ?? [];
}

/**
 * Pedidos de um processo, do mais novo para o mais antigo.
 *
 * Existe separada de `listarAprovacoesPendentes` de propósito: aquela tem nome
 * de fila do admin e é usada para montar botões de decidir. O profissional
 * enxerga os pedidos dos processos dele pela mesma RLS, mas o UPDATE exige
 * `is_admin()` — reusar a outra função aqui convidaria alguém a pendurar um
 * "Aprovar" que sempre falharia. Esta é só de leitura, para a tela saber que já
 * existe pedido em aberto e não deixar o profissional abrir um segundo.
 */
export async function listarMeusPedidos(propertyId: string): Promise<Aprovacao[]> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("property_id", propertyId)
    .order("solicitado_em", { ascending: false });

  if (error) throw new Error("Não foi possível carregar os pedidos deste processo.");
  return data ?? [];
}

export async function decidirAprovacao(
  id: string,
  aprovado: boolean,
  motivo?: string,
): Promise<void> {
  // Só atualiza se ainda estiver pendente. Dois admins olhando a mesma fila é
  // o cenário provável, e sem este filtro o segundo receberia a mensagem
  // genérica de falha sem entender que o pedido já tinha sido resolvido.
  const { data, error } = await supabase
    .from("approval_requests")
    .update({
      status: aprovado ? "aprovado" : "recusado",
      motivo_recusa: aprovado ? null : (motivo ?? null),
    })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id");

  if (error) throw new Error("Não foi possível registrar a decisão.");

  // Nenhuma linha alterada: o pedido saiu de 'pendente' entre a tela carregar
  // e o clique. O gatilho no banco cobre a corrida de verdade; este filtro
  // existe para a mensagem fazer sentido para quem clicou.
  if (!data || data.length === 0) {
    throw new Error("Este pedido já foi decidido por outro administrador.");
  }
}
