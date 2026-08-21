/**
 * Anotação interna do processo.
 *
 * Tabela própria por privacidade: process_stages é legível pelo cliente e a
 * RLS filtra linha, não coluna — guardar ali vazaria o conteúdo numa consulta
 * direta, mesmo sem aparecer na tela dele. Aqui o cliente não tem política
 * nenhuma, então a consulta dele volta vazia.
 *
 * Uma anotação por processo: a interface é um campo de texto único, e várias
 * linhas só criariam a dúvida de qual é a boa. A unicidade não é imposta pelo
 * banco — não há índice único em property_id —, então duas abas salvando ao
 * mesmo tempo podem criar duas linhas. Quem lê sempre pega a mais antiga, de
 * modo que a segunda linha ficaria invisível, não corromperia a tela.
 */
import { supabase } from "@/integrations/supabase/client";

export async function carregarNota(propertyId: string): Promise<string> {
  const { data, error } = await supabase
    .from("process_notes")
    .select("conteudo")
    .eq("property_id", propertyId)
    .order("criada_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar as anotações.");
  return data?.conteudo ?? "";
}

export async function salvarNota(propertyId: string, conteudo: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existente } = await supabase
    .from("process_notes")
    .select("id")
    .eq("property_id", propertyId)
    .order("criada_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  const erro = existente
    ? (
        await supabase
          .from("process_notes")
          .update({ conteudo, atualizada_em: new Date().toISOString() })
          .eq("id", existente.id)
      ).error
    : (
        await supabase
          .from("process_notes")
          .insert({ property_id: propertyId, conteudo, autor_id: user?.id ?? null })
      ).error;

  if (erro) throw new Error("Não foi possível salvar as anotações.");
}
