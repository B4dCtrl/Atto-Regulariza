/**
 * Processos sem profissional e os pedidos para assumi-los.
 *
 * O profissional não lê `properties` alheia (RLS); a vitrine vem de uma função
 * no banco que devolve só o caso, sem dado pessoal do cliente. Ver
 * 20261009d_pedidos_de_atribuicao.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProcessoSemAtribuicao {
  id: string;
  tipo_imovel: string | null;
  situacao: string | null;
  objetivo: string | null;
  city: string | null;
  state: string | null;
  criado_em: string;
  ja_pedi: boolean;
}

export async function listarSemAtribuicao(): Promise<ProcessoSemAtribuicao[]> {
  const { data, error } = await supabase.rpc("processos_sem_atribuicao");
  if (error) throw new Error("Não foi possível carregar os processos sem atribuição.");
  return (data ?? []) as ProcessoSemAtribuicao[];
}

/** Pede ao admin para assumir. O banco avisa o admin no sino. */
export async function solicitarAtribuicao(propertyId: string): Promise<void> {
  const { error } = await supabase.rpc("solicitar_atribuicao", { _property_id: propertyId });
  if (error) {
    // As duas recusas previstas já vêm com texto para a tela.
    const conhecida = /já tem profissional|profissional aprovado/.test(error.message);
    throw new Error(conhecida ? error.message : "Não foi possível enviar o pedido.");
  }
}

export interface PedidoComProfissional {
  id: string;
  profissional_id: string;
  criado_em: string;
  nome: string;
}

/** Pedidos abertos de um processo, para o admin escolher. */
export async function listarPedidosDoProcesso(
  propertyId: string,
): Promise<PedidoComProfissional[]> {
  const { data, error } = await supabase
    .from("pedidos_atribuicao")
    .select("id, profissional_id, criado_em")
    .eq("property_id", propertyId)
    .eq("status", "pendente")
    .order("criado_em");
  if (error || !data?.length) return [];

  const { data: perfis } = await supabase
    .from("profiles")
    .select("id, name")
    .in(
      "id",
      data.map((p) => p.profissional_id),
    );
  const nomes = new Map((perfis ?? []).map((p) => [p.id, p.name ?? "Profissional"]));

  return data.map((p) => ({ ...p, nome: nomes.get(p.profissional_id) ?? "Profissional" }));
}
