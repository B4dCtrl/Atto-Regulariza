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
 * Webhook do WhatsApp.
 *
 * Atendido aqui, antes do roteador da aplicação, porque não é página: a Meta
 * espera texto puro e um 200 rápido, e passar pelo SSR só somaria latência
 * num caminho que ela reenvia quando demora.
 *
 * O import é dinâmico para o código do WhatsApp não entrar no pacote de toda
 * requisição de página.
 */
const CAMINHO_WHATSAPP = "/api/whatsapp";

async function tratarWhatsApp(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== CAMINHO_WHATSAPP) return null;

  const { verificarWebhook, receberWebhook } = await import("./lib/api/whatsapp.server");

  if (request.method === "GET") return verificarWebhook(url);
  if (request.method === "POST") return receberWebhook(request);
  return new Response("method not allowed", { status: 405 });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const doWhatsApp = await tratarWhatsApp(request, new URL(request.url));
      if (doWhatsApp) return doWhatsApp;

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
