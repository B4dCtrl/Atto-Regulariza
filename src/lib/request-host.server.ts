import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Host da requisição (ex.: "curso.atoregulariza.com.br"). Isolado numa
 * server function porque @tanstack/react-start/server não pode ser
 * importado por arquivos que também são bundlados pro cliente (como
 * __root.tsx) — createServerFn cria um stub RPC seguro pro client bundle.
 */
export const getRequestHost = createServerFn({ method: "GET" }).handler(async () => {
  return getRequest().headers.get("host") ?? "";
});
