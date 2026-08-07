/**
 * Recebe o arquivo, valida e grava.
 *
 * O arquivo passa por aqui em vez de ir direto ao Storage porque validação no
 * navegador serve ao usuário, não ao atacante: quem controla o cliente controla
 * o que o cliente declara. Este é o único caminho de escrita no bucket — a RLS
 * do Storage não dá INSERT a authenticated.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, json } from "../_shared/cors.ts";
import { validarArquivo } from "../_shared/documento-validacao.ts";

const LIMITE_UPLOADS_POR_HORA = 60;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  try {
    // ---- 1. Autenticação ----
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

    // ---- 2. Entrada ----
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    const propertyId = String(form.get("property_id") ?? "");
    const kind = String(form.get("kind") ?? "outro");
    const origem = String(form.get("origem") ?? "cliente");
    const documentIdEntrada = form.get("document_id")
      ? String(form.get("document_id"))
      : null;

    if (!(arquivo instanceof File)) return json({ error: "Arquivo ausente" }, 400, cors);
    if (!propertyId) return json({ error: "Processo não informado" }, 400, cors);
    if (origem !== "cliente" && origem !== "profissional") {
      return json({ error: "Origem inválida" }, 400, cors);
    }

    // ---- 3. Autorização — antes de ler um byte do arquivo ----
    // É isto que impede forjar requisição para mexer em documento de terceiro:
    // o alvo é sempre conferido contra a identidade do token.
    if (documentIdEntrada) {
      const { data: pode } = await supabase.rpc("can_write_document", {
        _document_id: documentIdEntrada,
      });
      if (pode !== true) return json({ error: "Acesso negado" }, 403, cors);
    } else {
      const { data: pode } = await supabase.rpc("can_access_property", {
        _property_id: propertyId,
      });
      if (pode !== true) return json({ error: "Acesso negado" }, 403, cors);

      // Só quem gerencia o processo cria documento de origem profissional —
      // senão o cliente criaria peça técnica se passando por profissional.
      if (origem === "profissional") {
        const { data: gerencia } = await supabase.rpc("can_manage_property", {
          _property_id: propertyId,
        });
        if (gerencia !== true) return json({ error: "Acesso negado" }, 403, cors);
      }
    }

    // ---- 4. Cota: gravar arquivo custa armazenamento ----
    const { data: dentroDaCota, error: cotaErr } = await supabase.rpc("consume_ai_quota", {
      _limit_per_hour: LIMITE_UPLOADS_POR_HORA,
    });
    if (cotaErr) {
      console.error("Falha na cota de upload", cotaErr);
      return json({ error: "Erro ao verificar limite de uso" }, 500, cors);
    }
    if (dentroDaCota !== true) {
      return json({ error: "Muitos envios seguidos. Tente novamente em instantes." }, 429, cors);
    }

    // ---- 5. Validação de conteúdo ----
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const validacao = validarArquivo({
      bytes,
      mime: arquivo.type,
      nome: arquivo.name,
      tamanho: bytes.byteLength,
    });
    if (!validacao.ok) {
      const status = validacao.codigo === "tamanho" ? 413 : 400;
      return json({ error: validacao.mensagem, codigo: validacao.codigo }, status, cors);
    }

    // ---- 6. Gravação (service_role: contorna RLS de propósito, já autorizado) ----
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let documentId = documentIdEntrada;
    if (!documentId) {
      const { data: doc, error: docErr } = await admin
        .from("documents")
        .insert({
          property_id: propertyId,
          name: validacao.nome,
          kind,
          origem,
          status: "Enviado",
          uploaded_by: user.id,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (docErr || !doc) {
        console.error("Falha ao criar documento", docErr);
        return json({ error: "Erro ao registrar documento" }, 500, cors);
      }
      documentId = doc.id;
    }

    const { data: versao } = await admin.rpc("proxima_versao", { _document_id: documentId });
    const versionNumber = (versao as number) ?? 1;

    const versionId = crypto.randomUUID();
    // Caminho só com UUIDs: o nome enviado nunca compõe caminho, o que elimina
    // a classe inteira de path traversal em vez de tentar filtrá-la.
    const storagePath = `${propertyId}/${documentId}/${versionId}`;

    const { error: upErr } = await admin.storage
      .from("documentos")
      .upload(storagePath, bytes, { contentType: arquivo.type, upsert: false });
    if (upErr) {
      console.error("Falha ao gravar no Storage", upErr);
      return json({ error: "Erro ao salvar o arquivo" }, 500, cors);
    }

    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: novaVersao, error: verErr } = await admin
      .from("document_versions")
      .insert({
        id: versionId,
        document_id: documentId,
        version_number: versionNumber,
        storage_path: storagePath,
        original_name: validacao.nome,
        mime_type: arquivo.type,
        size_bytes: bytes.byteLength,
        checksum_sha256: checksum,
        uploaded_by: user.id,
      })
      .select("id")
      .single();

    if (verErr || !novaVersao) {
      // Não deixa arquivo órfão no bucket quando o banco recusa.
      await admin.storage.from("documentos").remove([storagePath]);
      console.error("Falha ao registrar versão", verErr);
      return json({ error: "Erro ao registrar a versão" }, 500, cors);
    }

    await admin
      .from("documents")
      .update({
        current_version_id: versionId,
        name: validacao.nome,
        size_text: `${Math.max(1, Math.round(bytes.byteLength / 1024))} KB`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return json(
      { document_id: documentId, version_id: versionId, version_number: versionNumber },
      200,
      cors,
    );
  } catch (e) {
    console.error("upload-documento error", e);
    return json({ error: "Erro interno" }, 500, cors);
  }
});
