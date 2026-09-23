import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Leva a falha até o sino do admin.
 *
 * Antes disto, erro de servidor morria no log da Vercel — que ninguém abre por
 * hábito, só quando já desconfia de alguma coisa. As três falhas graves de
 * agosto (o assistente, a Central de documentos, o upload de maquete) ficaram
 * meses invisíveis por isso.
 *
 * NUNCA lança e nunca atrasa quem chamou: é telemetria. Uma falha ao avisar
 * sobre uma falha não pode virar a falha principal.
 *
 * O que NÃO cobre: erro no navegador do cliente. Para isso seria preciso um
 * coletor no front, e a decisão foi não trazer fornecedor novo agora.
 */
export function avisarErro(origem: string, erro: unknown): Promise<void> {
  const detalhe = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);

  // Quem chama escolhe: sem await, o usuário não espera o admin ser avisado;
  // com await, a função serverless não congela antes do aviso sair. O `catch`
  // engole porque não há a quem reportar aqui.
  return Promise.resolve(
    supabaseAdmin.rpc("avisar_erro", { _origem: origem, _detalhe: detalhe }),
  ).then(
    ({ error }) => {
      if (error) console.error("[avisarErro] não foi possível avisar:", error.message);
    },
    (e) => console.error("[avisarErro] não foi possível avisar:", e),
  );
}
