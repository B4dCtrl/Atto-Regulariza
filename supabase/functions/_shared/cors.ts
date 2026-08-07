/**
 * CORS restrito. Nunca "*": com origem aberta, qualquer site poderia chamar
 * estas funções a partir do navegador de um usuário logado.
 */
const ORIGENS_PERMITIDAS = new Set([
  "https://atoregulariza.com.br",
  "https://www.atoregulariza.com.br",
  "https://curso.atoregulariza.com.br",
  "http://localhost:8080",
]);

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS_PERMITIDAS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(payload: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
