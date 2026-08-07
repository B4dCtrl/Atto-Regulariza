// Streaming chat para o back office Regulariza usando Lovable AI Gateway.
//
// SEGURANÇA (2026-08-07):
//  - verify_jwt = true no config.toml: o gateway do Supabase rejeita requisição sem JWT válido.
//  - Dupla checagem aqui: getUser() confirma a sessão e is_admin() restringe ao back office.
//  - CORS restrito a origens conhecidas (era "*", permitia chamada de qualquer site).
//  - Body validado: só papéis "user"/"assistant" são aceitos, o que impede um cliente
//    malicioso de injetar {role:"system"} e reescrever as instruções do assistente.
//  - Rate limit por usuário via tabela ai_usage — a função gasta créditos pagos.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://atoregulariza.com.br",
  "https://www.atoregulariza.com.br",
  "https://curso.atoregulariza.com.br",
  "http://localhost:8080",
]);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const MAX_MESSAGES = 30;
const MAX_CONTENT_LENGTH = 4000;
/** Requisições permitidas por usuário por hora. */
const RATE_LIMIT_PER_HOUR = 60;

type Msg = { role: "user" | "assistant"; content: string };

/** Valida o corpo sem dependência externa. Devolve as mensagens ou uma mensagem de erro. */
function parseBody(body: unknown): { ok: true; messages: Msg[] } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Corpo inválido" };
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) return { ok: false, error: "messages deve ser uma lista" };
  if (messages.length === 0) return { ok: false, error: "messages vazio" };
  if (messages.length > MAX_MESSAGES) return { ok: false, error: "Conversa longa demais" };

  const out: Msg[] = [];
  for (const m of messages) {
    if (typeof m !== "object" || m === null) return { ok: false, error: "Mensagem inválida" };
    const { role, content } = m as { role?: unknown; content?: unknown };
    // Só user/assistant: bloqueia injeção de system prompt pelo cliente.
    if (role !== "user" && role !== "assistant") return { ok: false, error: "Papel não permitido" };
    if (typeof content !== "string" || content.length === 0) return { ok: false, error: "Conteúdo vazio" };
    if (content.length > MAX_CONTENT_LENGTH) return { ok: false, error: "Mensagem longa demais" };
    out.push({ role, content });
  }
  return { ok: true, messages: out };
}

const SYSTEM_PROMPT = `Você é o assistente do back office Regulariza, plataforma brasileira de regularização imobiliária.
Tira dúvidas internas da equipe sobre processos: matrícula, habite-se, averbação, usucapião, ITBI, inventário, regularização fundiária.
Estilo: direto, prático, sem juridiquês, em português do Brasil. Usa bullets quando ajuda. Se a dúvida fugir do escopo (assuntos pessoais, política, etc.), redirecione para o tema.`;

function json(payload: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  try {
    // ---- Autenticação: a sessão do chamador, não a chave anônima ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401, cors);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Não autenticado" }, 401, cors);

    // ---- Autorização: o chat é ferramenta interna, só admin usa ----
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
    if (adminErr || isAdmin !== true) return json({ error: "Acesso negado" }, 403, cors);

    // ---- Validação do corpo ----
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400, cors);
    }
    const parsed = parseBody(rawBody);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);

    // ---- Rate limit por usuário (a chamada gasta créditos pagos) ----
    const { data: allowed, error: rateErr } = await supabase.rpc("consume_ai_quota", {
      _limit_per_hour: RATE_LIMIT_PER_HOUR,
    });
    if (rateErr) {
      console.error("Falha no controle de quota", rateErr);
      return json({ error: "Erro ao verificar limite de uso" }, 500, cors);
    }
    if (allowed !== true) {
      return json({ error: "Limite de uso por hora atingido. Tente mais tarde." }, 429, cors);
    }

    // ---- Chamada ao gateway de IA ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY ausente");
      return json({ error: "Serviço de IA indisponível" }, 500, cors);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...parsed.messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return json({ error: "Muitas requisições. Tente em instantes." }, 429, cors);
      }
      if (response.status === 402) {
        return json({ error: "Créditos da IA esgotados. Adicione saldo em Workspace → Usage." }, 402, cors);
      }
      console.error("Gateway error", response.status, await response.text());
      return json({ error: "Erro no gateway de IA" }, 500, cors);
    }

    return new Response(response.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    // Log completo no servidor; mensagem genérica para o cliente (não vaza detalhe interno).
    console.error("admin-chat error", e);
    return json({ error: "Erro interno" }, 500, cors);
  }
});
