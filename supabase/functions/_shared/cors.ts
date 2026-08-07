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

  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };

  // Origem desconhecida: OMITE o cabeçalho em vez de responder "null".
  // O literal "null" é uma origem válida para contextos de origem opaca
  // (iframe com sandbox, documento carregado de data:), que passariam a ser
  // aceitos. Sem o cabeçalho, nenhum navegador libera a resposta.
  if (ORIGENS_PERMITIDAS.has(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
  }

  return base;
}

export function json(payload: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
