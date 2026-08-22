import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `Você é a assistente virtual da Ato Regulariza, plataforma brasileira de regularização imobiliária.
Ajude de forma clara, objetiva e acolhedora, sempre em português do Brasil.
Explique etapas, documentos necessários e próximos passos do processo.
NUNCA prometa prazos garantidos nem dê parecer jurídico definitivo — deixe claro que o profissional responsável valida cada caso.
Se não souber algo específico do caso, diga que vai encaminhar ao especialista responsável.
Responda em no máximo 2 parágrafos curtos.`;

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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("IA não configurada no servidor.");
    const modelo = process.env.ANTHROPIC_MODEL || "claude-opus-5";

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

    const contexto =
      `Contexto do imóvel: ${prop.name}` +
      (prop.tipo_imovel ? ` · tipo: ${prop.tipo_imovel}` : "") +
      (prop.situacao ? ` · situação: ${prop.situacao}` : "") +
      ` · etapa: ${prop.status} (${prop.progress}%)` +
      (prop.objetivo ? ` · objetivo do cliente: ${prop.objetivo}` : "");

    // 3) Chamada ao Claude
    let reply = "";
    try {
      const cliente = new Anthropic({ apiKey });
      const resposta = await cliente.messages.create(
        {
          model: modelo,
          max_tokens: 1000,
          // Resposta curta de atendimento: esforço baixo entrega o mesmo texto
          // por uma fração do tempo, e o cliente está esperando na tela.
          output_config: { effort: "low" },
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
    } catch (e) {
      console.error("[assistente] falha ao consultar a IA:", e);
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
