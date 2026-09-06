/**
 * Webhook de mensagens: recebe o que o cliente escreve e responde a triagem.
 *
 * Atende **WhatsApp e Instagram na mesma URL** — a Meta manda os dois para cá
 * e se identifica pelo campo `object` do corpo. A triagem é a mesma nos dois;
 * muda só quem entrega.
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
import { montarPayloadIg, lerEntradaIg } from "@/lib/instagram-formato";

/**
 * Cada canal tem seu endereço.
 *
 * O WhatsApp fala pelo graph.facebook.com; a API do Instagram com login do
 * Instagram fala pelo graph.instagram.com. Mandar para o host errado devolve
 * um 400 que não explica nada.
 */
const HOST = {
  whatsapp: "https://graph.facebook.com/v21.0",
  instagram: "https://graph.instagram.com/v21.0",
} as const;

/**
 * De onde veio a conversa.
 *
 * A triagem é a mesma; muda quem entrega. Guardamos no identificador da
 * conversa para que o mesmo telefone no WhatsApp e o mesmo perfil no Instagram
 * nunca se misturem — e para saber por onde responder.
 */
export type Canal = "whatsapp" | "instagram";

/**
 * Assinatura da requisição.
 *
 * Sem isto, qualquer um que descubra a URL conversa com o bot fingindo ser a
 * Meta — e cada mensagem que o bot responde é uma conversa cobrada. A Meta
 * assina o corpo com o App Secret; conferimos antes de olhar o conteúdo.
 */
async function assinaCom(segredo: string, corpoBruto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinado = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoBruto));
  return [...new Uint8Array(assinado)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara em tempo constante: `===` vaza, pelo tempo, quantos caracteres o atacante acertou. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/**
 * Assinatura da requisição.
 *
 * Sem isto, qualquer um que descubra a URL conversa com o bot fingindo ser a
 * Meta — e cada mensagem que o bot responde é uma conversa cobrada.
 *
 * **São duas chaves.** O app do Facebook e o app do Instagram têm segredos
 * diferentes, e a mesma URL recebe os dois canais. Aceitamos qualquer uma das
 * duas: o corpo diz de qual canal veio, mas conferir a assinatura antes de
 * confiar no corpo é justamente o ponto.
 */
async function assinaturaConfere(corpoBruto: string, cabecalho: string | null): Promise<boolean> {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const recebido = cabecalho.slice("sha256=".length);

  const segredos = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(
    (x): x is string => Boolean(x),
  );

  for (const segredo of segredos) {
    if (iguais(await assinaCom(segredo, corpoBruto), recebido)) return true;
  }
  return false;
}

/** Número desconhecido para a Meta. Ver telefone-br.ts. */
const ERRO_NUMERO_NAO_PERMITIDO = 131030;

type Tentativa = { ok: true } | { ok: false; status: number; corpo: string };

async function tentarEnvio(
  origemId: string,
  token: string,
  para: string,
  envio: Envio,
  canal: Canal,
): Promise<Tentativa> {
  const corpo = canal === "instagram" ? montarPayloadIg(para, envio) : montarPayload(para, envio);

  const res = await fetch(`${HOST[canal]}/${origemId}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, corpo: await res.text().catch(() => "") };
}

/** Credenciais do canal, ou null quando não estão configuradas. */
function credenciais(canal: Canal): { token: string; origemId: string } | null {
  const token = canal === "instagram" ? process.env.INSTAGRAM_TOKEN : process.env.WHATSAPP_TOKEN;
  const origemId =
    canal === "instagram" ? process.env.INSTAGRAM_ACCOUNT_ID : process.env.WHATSAPP_PHONE_ID;

  if (!token || !origemId) {
    console.error(`[${canal}] token ou id da conta ausente nas variáveis de ambiente`);
    return null;
  }
  return { token, origemId };
}

async function enviar(para: string, envio: Envio, canal: Canal): Promise<void> {
  const cred = credenciais(canal);
  if (!cred) return;

  let r = await tentarEnvio(cred.origemId, cred.token, para, envio, canal);

  // O nono dígito, só no WhatsApp: a mensagem chega de 554184471404 e a Meta
  // pode só conhecer 5541984471404 — mesmo telefone, duas grafias. Quando ela
  // diz que não conhece o número, tentamos a outra antes de desistir.
  // No Instagram o destinatário é um id numérico, não um telefone.
  if (canal === "whatsapp" && !r.ok && r.corpo.includes(String(ERRO_NUMERO_NAO_PERMITIDO))) {
    const outra = formaAlternativa(para);
    if (outra) {
      console.warn(`[whatsapp] ${para} recusado; tentando ${outra}`);
      r = await tentarEnvio(cred.origemId, cred.token, outra, envio, canal);
    }
  }

  if (!r.ok) {
    console.error(`[${canal}] envio recusado`, r.status, r.corpo.slice(0, 300));
    avisarErro(`envio pelo ${canal}`, `${r.status}: ${r.corpo.slice(0, 200)}`);
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
async function gravarLead(
  contato: string,
  estado: Estado,
  canal: Canal,
): Promise<string | undefined> {
  const r = estado.resultado;
  if (!r) return undefined;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: estado.respostas.nome ?? null,
      // No Instagram não há telefone: o contato é o id do perfil, e guardá-lo
      // como telefone daria um número que ninguém consegue discar.
      phone: canal === "whatsapp" ? contato : null,
      city: r.cidade || null,
      tipo_imovel: estado.respostas.imovel ?? null,
      objetivo: estado.respostas.motivo ?? null,
      notes: r.relato,
      source: canal,
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

  await avisarAdmins(contato, estado);
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

/**
 * De qual canal veio este webhook, e o que a pessoa disse.
 *
 * Os dois chegam na mesma URL: a Meta identifica pelo campo `object`, que é
 * "whatsapp_business_account" ou "instagram".
 */
function interpretar(
  corpo: unknown,
): { canal: Canal; de: string; texto: string; idMensagem: string } | null {
  const objeto = (corpo as { object?: string })?.object;

  if (objeto === "instagram") {
    const e = lerEntradaIg(corpo);
    if (!e) return null;
    const idMensagem =
      (corpo as { entry?: { messaging?: { message?: { mid?: string } }[] }[] }).entry?.[0]
        ?.messaging?.[0]?.message?.mid ?? "";
    return { canal: "instagram", de: e.de, texto: e.texto, idMensagem };
  }

  const e = lerEntrada(corpo);
  if (!e) return null;
  const idMensagem =
    (corpo as { entry?: { changes?: { value?: { messages?: { id?: string }[] } }[] }[] }).entry?.[0]
      ?.changes?.[0]?.value?.messages?.[0]?.id ?? "";
  return { canal: "whatsapp", de: e.de, texto: e.texto, idMensagem };
}

/**
 * Chave da conversa no banco.
 *
 * O canal entra no identificador porque os espaços de numeração são
 * diferentes: um id de perfil do Instagram pode, por coincidência, ser igual a
 * um telefone. Sem o prefixo, duas pessoas distintas dividiriam a mesma
 * triagem pela metade.
 */
function chaveDaConversa(canal: Canal, de: string): string {
  return canal === "instagram" ? `ig:${de}` : de;
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
    const entrada = interpretar(corpo);
    if (!entrada) return new Response("ok");

    if (entrada.idMensagem && (await jaVista(entrada.idMensagem))) return new Response("ok");

    const chave = chaveDaConversa(entrada.canal, entrada.de);
    const anterior = await carregarEstado(chave);

    const passo = anterior ? avancar(anterior, entrada.texto) : iniciar(entrada.texto);
    const envios = [...passo.envios];

    let leadId: string | undefined;
    if (passo.estado.encerrada && !anterior?.encerrada) {
      if (passo.estado.resultado) {
        leadId = await gravarLead(chave, passo.estado, entrada.canal);
      }
      envios.push(convite(passo.estado));
    }

    await salvarEstado(chave, passo.estado, leadId);

    // Em ordem: a entrega respeita a ordem de chegada, e pergunta antes da
    // saudação confundiria.
    for (const envio of envios) await enviar(entrada.de, envio, entrada.canal);

    return new Response("ok");
  } catch (e) {
    console.error("[webhook] falha", e);
    avisarErro("webhook de mensagens", (e as Error).message);
    return new Response("ok");
  }
}
