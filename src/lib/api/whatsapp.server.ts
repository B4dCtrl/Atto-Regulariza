/**
 * Webhook do WhatsApp: recebe a mensagem do cliente e responde a triagem.
 *
 * Roda só no servidor. As credenciais vivem em variáveis de ambiente e nunca
 * chegam ao navegador.
 *
 * A Meta chama isto de dois jeitos:
 * - **GET**, uma vez, para verificar que a URL é nossa
 * - **POST**, a cada evento — mensagem, recibo de entrega, recibo de leitura
 */

import process from "node:process";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { iniciar, avancar, type Estado, type Envio } from "@/lib/conversa-triagem";
import { montarPayload, lerEntrada } from "@/lib/whatsapp-formato";
import { ATENDIMENTO_PHONE } from "@/lib/brand";
import { formaAlternativa } from "@/lib/telefone-br";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Assinatura da requisição.
 *
 * Sem isto, qualquer um que descubra a URL conversa com o bot fingindo ser a
 * Meta — e cada mensagem que o bot responde é uma conversa cobrada. A Meta
 * assina o corpo com o App Secret; conferimos antes de olhar o conteúdo.
 */
async function assinaturaConfere(corpoBruto: string, cabecalho: string | null): Promise<boolean> {
  const segredo = process.env.META_APP_SECRET;
  if (!segredo || !cabecalho?.startsWith("sha256=")) return false;

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinado = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoBruto));
  const esperado = [...new Uint8Array(assinado)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const recebido = cabecalho.slice("sha256=".length);
  if (recebido.length !== esperado.length) return false;

  // Comparação de tempo constante: comparar com === vaza, pelo tempo de
  // resposta, quantos caracteres iniciais o atacante acertou.
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diferenca === 0;
}

/** Número desconhecido para a Meta. Ver telefone-br.ts. */
const ERRO_NUMERO_NAO_PERMITIDO = 131030;

type Tentativa = { ok: true } | { ok: false; status: number; corpo: string };

async function tentarEnvio(
  phoneId: string,
  token: string,
  para: string,
  envio: Envio,
): Promise<Tentativa> {
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(montarPayload(para, envio)),
  });
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, corpo: await res.text().catch(() => "") };
}

async function enviar(para: string, envio: Envio): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error("[whatsapp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID ausente");
    return;
  }

  let r = await tentarEnvio(phoneId, token, para, envio);

  // O nono dígito: a mensagem chega de 554184471404 e a Meta pode só conhecer
  // 5541984471404 — mesmo telefone, duas grafias. Quando ela diz que não
  // conhece o número, tentamos a outra antes de desistir.
  if (!r.ok && r.corpo.includes(String(ERRO_NUMERO_NAO_PERMITIDO))) {
    const outra = formaAlternativa(para);
    if (outra) {
      console.warn(`[whatsapp] ${para} recusado; tentando ${outra}`);
      r = await tentarEnvio(phoneId, token, outra, envio);
    }
  }

  if (!r.ok) {
    console.error("[whatsapp] envio recusado", r.status, r.corpo.slice(0, 300));
    avisarErro("envio pelo WhatsApp", `${r.status}: ${r.corpo.slice(0, 200)}`);
  }
}

/**
 * Já processamos esta mensagem?
 *
 * A Meta reenvia o webhook quando não recebe 200 em poucos segundos. Sem esta
 * trava, uma resposta lenta faria o bot processar a mesma resposta duas vezes
 * e pular uma pergunta.
 */
async function jaVista(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from("whatsapp_mensagens_vistas").insert({
    mensagem_id: id,
  });
  // Violação de chave primária = já tínhamos visto.
  return error?.code === "23505";
}

async function carregarEstado(telefone: string): Promise<Estado | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("estado, encerrada")
    .eq("telefone", telefone)
    .maybeSingle();
  if (!data) return null;
  return data.estado as Estado;
}

async function salvarEstado(telefone: string, estado: Estado, leadId?: string): Promise<void> {
  await supabaseAdmin.from("whatsapp_conversas").upsert(
    {
      telefone,
      estado: estado as never,
      encerrada: estado.encerrada,
      atualizada_em: new Date().toISOString(),
      ...(leadId ? { lead_id: leadId } : {}),
    },
    { onConflict: "telefone" },
  );
}

/** Grava o lead classificado na tela que o admin já usa. */
async function gravarLead(telefone: string, estado: Estado): Promise<string | undefined> {
  const r = estado.resultado;
  if (!r) return undefined;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: estado.respostas.nome ?? null,
      phone: telefone,
      city: r.cidade || null,
      tipo_imovel: estado.respostas.imovel ?? null,
      objetivo: estado.respostas.motivo ?? null,
      notes: r.relato,
      source: "whatsapp",
      status: "novo",
      triagem_cor: r.cor,
      triagem_produto: r.produto,
      triagem_motivo: r.motivo,
      triagem_respostas: estado.respostas as never,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[whatsapp] falha ao gravar lead", error.message);
    avisarErro("triagem do WhatsApp", `lead não gravado: ${error.message}`);
    return undefined;
  }

  await avisarAdmins(telefone, estado);
  return data?.id;
}

/**
 * Cutuca os admins no sino do painel.
 *
 * Sem isto o lead cai numa lista que alguém precisa lembrar de abrir — e um
 * caso vermelho que chega às 23h fica invisível até alguém procurar. Não
 * derruba a conversa se falhar: a pessoa do outro lado não tem culpa de o
 * aviso não sair, e o lead já está gravado.
 */
async function avisarAdmins(telefone: string, estado: Estado): Promise<void> {
  const r = estado.resultado;
  if (!r) return;

  const { error } = await supabaseAdmin.rpc("avisar_lead_triagem", {
    _cor: r.cor,
    _nome: (estado.respostas.nome ?? "").trim(),
    _cidade: r.cidade,
    _telefone: telefone,
    _motivo: r.motivo,
  });

  if (error) console.error("[whatsapp] aviso não enviado", error.message);
}

/**
 * Encaminhamento para o humano.
 *
 * O bot só faz a triagem; quem atende é gente, no número de sempre. O link
 * já leva o resumo escrito, para a pessoa não precisar repetir tudo.
 */
function convite(estado: Estado): Envio {
  const nome = (estado.respostas.nome ?? "").trim();
  const cidade = (estado.respostas.cidade ?? "").trim();
  const resumo = encodeURIComponent(
    `Olá! Acabei de fazer a triagem pelo assistente.\n\n` +
      `Nome: ${nome}\nCidade: ${cidade}\nCaso: ${estado.respostas.relato ?? ""}`,
  );
  return {
    tipo: "texto",
    texto:
      `Para continuar com um especialista, é só tocar aqui: ` +
      `https://wa.me/${ATENDIMENTO_PHONE}?text=${resumo}`,
  };
}

/** Verificação da URL, feita uma vez quando você cadastra o webhook. */
export function verificarWebhook(url: URL): Response {
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const desafio = url.searchParams.get("hub.challenge") ?? "";

  if (modo === "subscribe" && esperado && token === esperado) {
    return new Response(desafio, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function receberWebhook(request: Request): Promise<Response> {
  const corpoBruto = await request.text();

  if (!(await assinaturaConfere(corpoBruto, request.headers.get("x-hub-signature-256")))) {
    return new Response("invalid signature", { status: 401 });
  }

  // A partir daqui sempre respondemos 200. Erro nosso não pode fazer a Meta
  // reenviar em loop; o que quebrar vira alerta no painel.
  try {
    const corpo = JSON.parse(corpoBruto) as unknown;
    const entrada = lerEntrada(corpo);
    if (!entrada) return new Response("ok");

    const idMensagem =
      (corpo as { entry?: { changes?: { value?: { messages?: { id?: string }[] } }[] }[] })
        .entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ?? "";
    if (idMensagem && (await jaVista(idMensagem))) return new Response("ok");

    const anterior = await carregarEstado(entrada.de);

    const passo = anterior ? avancar(anterior, entrada.texto) : iniciar(entrada.texto);
    const envios = [...passo.envios];

    let leadId: string | undefined;
    if (passo.estado.encerrada && !anterior?.encerrada) {
      if (passo.estado.resultado) {
        leadId = await gravarLead(entrada.de, passo.estado);
      }
      envios.push(convite(passo.estado));
    }

    await salvarEstado(entrada.de, passo.estado, leadId);

    // Em ordem: WhatsApp entrega na ordem em que chega, e pergunta antes da
    // saudação confundiria.
    for (const envio of envios) await enviar(entrada.de, envio);

    return new Response("ok");
  } catch (e) {
    console.error("[whatsapp] falha no webhook", e);
    avisarErro("webhook do WhatsApp", (e as Error).message);
    return new Response("ok");
  }
}
