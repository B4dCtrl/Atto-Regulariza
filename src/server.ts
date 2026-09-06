import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Webhook de mensagens — WhatsApp e Instagram, na mesma URL.
 *
 * Atendido aqui, antes do roteador da aplicação, porque não é página: a Meta
 * espera texto puro e um 200 rápido, e passar pelo SSR só somaria latência
 * num caminho que ela reenvia quando demora.
 *
 * O caminho continua /api/whatsapp para não invalidar o webhook já cadastrado
 * na Meta — trocar a URL exigiria reconfigurar tudo lá.
 *
 * O import é dinâmico para esse código não entrar no pacote de toda
 * requisição de página.
 */
const CAMINHO_MENSAGENS = "/api/whatsapp";

async function tratarWhatsApp(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== CAMINHO_MENSAGENS) return null;

  const { verificarWebhook, receberWebhook } = await import("./lib/api/mensagens.server");

  if (request.method === "GET") return verificarWebhook(url);
  if (request.method === "POST") return receberWebhook(request);
  return new Response("method not allowed", { status: 405 });
}

/**
 * Link curto do caso: /f/<codigo>.
 *
 * Redireciona para a conversa no WhatsApp da equipe, com uma saudação que
 * carrega só o código. Fica aqui, antes do roteador, porque é redirecionamento
 * puro — abrir uma página React para depois sair dela custaria um segundo de
 * tela branca no celular do cliente.
 */
async function tratarLinkCurto(url: URL): Promise<Response | null> {
  const achado = /^\/f\/([A-Z2-9]{6})$/.exec(url.pathname);
  if (!achado) return null;

  const { destinoDoCodigo } = await import("./lib/api/link-curto.server");
  return Response.redirect(destinoDoCodigo(achado[1]), 302);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      const doWhatsApp = await tratarWhatsApp(request, url);
      if (doWhatsApp) return doWhatsApp;

      const curto = await tratarLinkCurto(url);
      if (curto) return curto;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
