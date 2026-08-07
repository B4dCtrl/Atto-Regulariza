/**
 * Emite URL assinada de leitura, válida por 5 minutos.
 *
 * Pedida no momento de abrir o arquivo, não junto da listagem: assim a validade
 * começa a contar quando o arquivo é realmente aberto, e uma lista de 20
 * documentos não gera 20 links vivos à toa.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, json } from "../_shared/cors.ts";

const VALIDADE_SEGUNDOS = 300;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401, cors);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401, cors);

    let corpo: { version_id?: string };
    try {
      corpo = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400, cors);
    }
    if (!corpo.version_id) return json({ error: "Versão não informada" }, 400, cors);

    // Lê a versão com a sessão do usuário: a RLS de document_versions já aplica
    // can_read_document. Se a pessoa não tem direito, não vem linha nenhuma.
    const { data: versao } = await supabase
      .from("document_versions")
      .select("storage_path, mime_type")
      .eq("id", corpo.version_id)
      .maybeSingle();

    if (!versao) return json({ error: "Acesso negado" }, 403, cors);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: assinada, error } = await admin.storage
      .from("documentos")
      .createSignedUrl(versao.storage_path, VALIDADE_SEGUNDOS);

    if (error || !assinada) {
      console.error("Falha ao assinar URL", error);
      return json({ error: "Erro ao abrir o arquivo" }, 500, cors);
    }

    return json({ url: assinada.signedUrl, expira_em: VALIDADE_SEGUNDOS }, 200, cors);
  } catch (e) {
    console.error("documento-url error", e);
    return json({ error: "Erro interno" }, 500, cors);
  }
});
