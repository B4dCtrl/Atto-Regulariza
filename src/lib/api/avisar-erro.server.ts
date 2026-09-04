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
export function avisarErro(origem: string, erro: unknown): void {
  const detalhe = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);

  // Sem await de propósito: o admin ser avisado não pode fazer o usuário
  // esperar. O `catch` engole porque não há a quem reportar aqui.
  void supabaseAdmin
    .rpc("avisar_erro", { _origem: origem, _detalhe: detalhe })
    .then(({ error }) => {
      if (error) console.error("[avisarErro] não foi possível avisar:", error.message);
    });
}
