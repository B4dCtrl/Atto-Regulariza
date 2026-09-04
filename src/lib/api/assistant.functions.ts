import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { MODELO_IA, aceitaEsforco } from "@/lib/api/modelo-ia";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `Você é a assistente virtual da Ato Regulariza, plataforma brasileira de regularização imobiliária. Fala com o CLIENTE sobre o processo dele.

FORMATO — o chat mostra texto puro, sem formatação:
- NUNCA use markdown. Nada de #, **, listas com - ou *. Escreva em frases corridas.
- NUNCA use emoji.
- No máximo 2 parágrafos curtos. Sem saudação repetida se a conversa já começou.

CONTEÚDO:
- Use os dados do processo que estão no contexto. Se o contexto diz a etapa, cite a etapa; se lista pendências, cite as pendências pelo nome.
- NUNCA invente documento, prazo, valor ou etapa que não esteja no contexto.
- NUNCA prometa prazo garantido: prefeitura e cartório não dependem da Ato.
- NUNCA dê parecer jurídico. Quem valida cada caso é o profissional responsável.

ENCAMINHAMENTO — o mais importante:
- Quando a pergunta for específica do caso (o que exatamente falta, se um documento serve, o que o cartório vai exigir), diga que quem responde isso é o profissional responsável, CITANDO O NOME dele que está no contexto, e convide a pessoa a escrever aqui mesmo — ele lê esta conversa.
- Se o contexto disser que ainda não há profissional designado, explique que a equipe está escolhendo e que a pessoa será avisada.
- Nunca prometa que você mesma vai encaminhar, abrir chamado ou tomar providência: você não faz nada além de responder.`;

/**
 * Assistente de IA do chat (Claude, pela API da Anthropic).
 * Roda só no servidor: a chave (ANTHROPIC_API_KEY) nunca chega ao navegador.
 * Sob demanda — gera UMA resposta para a conversa do processo e a grava em
 * `messages` (sender "Assistente IA"), aparecendo para cliente e profissional.
 */
export const chatAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // Cota antes de gastar.
    //
    // A função existe desde a auditoria de segurança e só o upload a usava — o
    // chat podia ser chamado à vontade. Como agora cada pergunta custa dinheiro
    // de verdade, um cliente sozinho poderia consumir o saldo do mês numa
    // tarde.
    //
    // Vai pelo cliente do MIDDLEWARE, não pelo supabaseAdmin: a função lê
    // `auth.uid()`, que é nulo sob service_role e devolveria false sempre.
    const { data: dentroDaCota } = await context.supabase.rpc("consume_ai_quota", {
      _limit_per_hour: 30,
    });
    if (dentroDaCota !== true) {
      // Marcado para a tela distinguir cota de falha de verdade: quando a
      // resposta era automática, atingir a cota não merece aviso nenhum.
      throw new Error("COTA");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("IA não configurada no servidor.");

    // 1) Carrega o processo e valida acesso do solicitante
    const { data: prop } = await supabaseAdmin
      .from("properties")
      .select(
        "client_id, assigned_professional_id, name, tipo_imovel, situacao, status, progress, objetivo",
      )
      .eq("id", data.propertyId)
      .single();
    if (!prop) throw new Error("Processo não encontrado.");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (
      prop.client_id !== context.userId &&
      prop.assigned_professional_id !== context.userId &&
      !isAdmin
    ) {
      throw new Error("Sem acesso a este processo.");
    }

    // 1b) Quem cuida do caso — a IA precisa do nome para encaminhar.
    let profissional: { name: string | null; specialization: string | null } | null = null;
    if (prop.assigned_professional_id) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("name, specialization")
        .eq("id", prop.assigned_professional_id)
        .maybeSingle();
      profissional = data ?? null;
    }

    // 2) Últimas mensagens (contexto da conversa)
    const { data: recent } = await supabaseAdmin
      .from("messages")
      .select("sender_name, content, is_client")
      .eq("property_id", data.propertyId)
      .order("created_at", { ascending: false })
      .limit(15);
    const transcript = (recent ?? [])
      .reverse()
      .map((m) => `${m.is_client ? "Cliente" : m.sender_name}: ${m.content}`)
      .join("\n");

    // Pendências abertas: é o que o cliente mais pergunta e o que a IA mais
    // erraria se tivesse de adivinhar.
    const { data: pendencias } = await supabaseAdmin
      .from("pendencies")
      .select("descricao")
      .eq("property_id", data.propertyId)
      .eq("status", "aberta")
      .limit(5);

    const contexto = [
      `Imóvel: ${prop.name}`,
      prop.tipo_imovel ? `Tipo: ${prop.tipo_imovel}` : null,
      prop.situacao ? `Situação: ${prop.situacao}` : null,
      `Etapa atual: ${prop.status} (${prop.progress}% concluído)`,
      prop.objetivo ? `Objetivo do cliente: ${prop.objetivo}` : null,
      profissional?.name
        ? `Profissional responsável: ${profissional.name}` +
          (profissional.specialization ? ` (${profissional.specialization})` : "")
        : "Profissional responsável: ainda não designado — a equipe está escolhendo.",
      (pendencias ?? []).length > 0
        ? `Pendências abertas com o cliente: ${(pendencias ?? []).map((p) => p.descricao).join("; ")}`
        : "Pendências abertas com o cliente: nenhuma.",
    ]
      .filter(Boolean)
      .join("\n");

    // 3) Chamada ao Claude
    let reply = "";
    try {
      const cliente = new Anthropic({ apiKey });
      const resposta = await cliente.messages.create(
        {
          model: MODELO_IA,
          max_tokens: 1000,
          // Esforço baixo quando o modelo aceita: é resposta curta e o cliente
          // está esperando na tela. No Haiku 4.5 o campo é recusado.
          ...(aceitaEsforco() ? { output_config: { effort: "low" as const } } : {}),
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `${contexto}\n\nConversa recente:\n${transcript || "(sem mensagens ainda)"}\n\nResponda de forma útil como Assistente da Ato Regulariza.`,
            },
          ],
        },
        { timeout: 45_000 },
      );

      // `content` é uma união discriminada: só o bloco de texto interessa.
      reply = resposta.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      // Cinto e suspensório contra markdown.
      //
      // O prompt proíbe, mas modelo escorrega — e o chat mostra texto puro, então
      // "**Sobre o prazo:**" chega assim mesmo ao cliente. Limpar aqui é
      // determinístico; confiar só na instrução, não.
      reply = reply
        .replace(/^#{1,6}\s+/gm, "") // títulos
        .replace(/\*\*(.+?)\*\*/g, "$1") // negrito
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1") // itálico
        .replace(/^[-*]\s+/gm, "") // marcadores de lista
        .replace(/`([^`]+)`/g, "$1") // código
        .trim();
    } catch (e) {
      console.error("[assistente] falha ao consultar a IA:", e);
      avisarErro("assistente do chat", e);
      throw new Error("Não foi possível consultar a IA agora.");
    }
    if (!reply) reply = "Não consegui gerar uma resposta agora. Tente novamente em instantes.";

    // 4) Grava a resposta no chat (visível para cliente e profissional via realtime)
    await supabaseAdmin.from("messages").insert({
      property_id: data.propertyId,
      sender_id: null,
      sender_name: "Assistente IA",
      content: reply,
      is_client: false,
    });

    return { content: reply };
  });
