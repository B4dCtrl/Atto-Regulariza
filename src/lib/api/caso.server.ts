/**
 * O caso por trás do código curto.
 *
 * `/f/K7M2QX` é página **pública**: quem tiver o link entra, sem senha. Por
 * isso devolve o mínimo — primeiro nome e cidade, que a pessoa já escreveu
 * ela mesma na triagem.
 *
 * Fica de fora tudo que é da equipe: telefone, relato, cor, motivo, produto.
 * Não porque o código seja fácil de adivinhar — são 729 milhões de
 * combinações — mas porque não há razão para expor, e o que não se expõe não
 * vaza.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALFABETO } from "@/lib/codigo-curto";

/** O que a página pode mostrar. */
export type CasoPublico = {
  primeiroNome: string;
  cidade: string;
  /** Já virou conta? Então o link não serve mais para cadastrar. */
  jaCadastrado: boolean;
};

/**
 * Valida o formato antes de tocar no banco: string arbitrária vinda da URL não
 * vira consulta, e o formato errado nem custa uma ida ao Postgres.
 */
const CODIGO_VALIDO = new RegExp(`^[${ALFABETO}]{6}$`);

export const buscarCaso = createServerFn({ method: "GET" })
  .inputValidator(z.object({ codigo: z.string().regex(CODIGO_VALIDO) }))
  .handler(async ({ data }): Promise<CasoPublico | null> => {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("name, city, converted")
      .eq("codigo", data.codigo)
      .maybeSingle();

    if (!lead) return null;

    const nome = (lead.name ?? "").trim();
    return {
      // Só o primeiro nome: sobrenome é dado pessoal que a página não precisa.
      primeiroNome: nome.split(/\s+/)[0] ?? "",
      cidade: lead.city ?? "",
      jaCadastrado: Boolean(lead.converted),
    };
  });

/**
 * As respostas da triagem, para o wizard não perguntar de novo.
 *
 * Devolve o que a própria pessoa respondeu — não a leitura interna. Cor,
 * motivo da classificação e produto sugerido continuam fora: são o julgamento
 * da Ato sobre o caso, e mostrar isso a quem só quer se cadastrar seria
 * estranho e desnecessário.
 */
export const respostasDoCaso = createServerFn({ method: "GET" })
  .inputValidator(z.object({ codigo: z.string().regex(CODIGO_VALIDO) }))
  .handler(async ({ data }): Promise<Record<string, string> | null> => {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("triagem_respostas, converted")
      .eq("codigo", data.codigo)
      .maybeSingle();

    // Lead já convertido não devolve mais nada: o link cumpriu a função, e
    // deixá-lo servindo dados depois disso só amplia a janela de exposição.
    if (!lead || lead.converted) return null;
    return (lead.triagem_respostas as Record<string, string> | null) ?? null;
  });

/**
 * Marca o lead como convertido depois que a conta foi criada.
 *
 * Exige sessão: só quem acabou de se cadastrar fecha o próprio caso. Sem isso,
 * qualquer um com o código marcaria leads alheios como convertidos e eles
 * sumiriam da fila da equipe.
 */
export const converterCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ codigo: z.string().regex(CODIGO_VALIDO) }))
  .handler(async ({ data }): Promise<void> => {
    const { error } = await supabaseAdmin
      .from("leads")
      .update({ converted: true, status: "ativo" })
      .eq("codigo", data.codigo)
      .eq("converted", false);

    if (error) console.error("[caso] falha ao converter lead", error.message);
  });
