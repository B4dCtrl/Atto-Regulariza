/**
 * Acesso a documentos pelo cliente do navegador.
 *
 * Upload e URL assinada passam pelas edge functions — não existe caminho direto
 * ao Storage, por decisão de segurança: a RLS do bucket não dá escrita a
 * authenticated, e a leitura sai sempre assinada e com prazo.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DocumentKind, DocumentOrigem } from "@/lib/document-kinds";

const BASE = import.meta.env.VITE_SUPABASE_URL;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface VersaoResumo {
  id: string;
  version_number: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string | null;
}

export interface DocumentoComVersao {
  id: string;
  property_id: string;
  name: string;
  kind: string;
  origem: string;
  status: string;
  created_at: string;
  versao: VersaoResumo | null;
}

async function tokenDaSessao(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão expirada. Entre novamente.");
  return session.access_token;
}

export async function enviarDocumento(params: {
  arquivo: File;
  propertyId: string;
  kind: DocumentKind;
  origem: DocumentOrigem;
  /** Informar para adicionar versão a um documento existente. */
  documentId?: string;
}): Promise<{ document_id: string; version_number: number }> {
  const token = await tokenDaSessao();

  const form = new FormData();
  form.append("arquivo", params.arquivo);
  form.append("property_id", params.propertyId);
  form.append("kind", params.kind);
  form.append("origem", params.origem);
  if (params.documentId) form.append("document_id", params.documentId);

  const resp = await fetch(`${BASE}/functions/v1/upload-documento`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: APIKEY,
    },
    body: form,
  });

  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // A função já devolve mensagem pronta para o usuário.
    throw new Error(corpo.error ?? "Não foi possível enviar o arquivo.");
  }
  return corpo;
}

export async function listarDocumentos(propertyId: string): Promise<DocumentoComVersao[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      `
      id, property_id, name, kind, origem, status, created_at, current_version_id,
      versoes:document_versions!document_versions_document_id_fkey (
        id, version_number, original_name, mime_type, size_bytes, created_at, uploaded_by
      )
    `,
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  // Detalhe do Postgres não interessa a quem está na tela — e pode vazar
  // nome de coluna, policy ou constraint.
  if (error) throw new Error("Não foi possível carregar os documentos.");

  return (data ?? []).map((d) => {
    const versoes = (d.versoes ?? []) as VersaoResumo[];
    // Sem current_version_id (documento anterior a esta migração) cai para a
    // versão de maior número; sem nenhuma versão, fica nulo.
    const vigente =
      versoes.find((v) => v.id === d.current_version_id) ??
      versoes.reduce<VersaoResumo | null>(
        (maior, v) => (maior === null || v.version_number > maior.version_number ? v : maior),
        null,
      );
    return {
      id: d.id,
      property_id: d.property_id,
      name: d.name,
      kind: d.kind,
      origem: d.origem,
      status: d.status,
      created_at: d.created_at,
      versao: vigente,
    };
  });
}

/** Histórico completo, da versão mais nova para a mais antiga. */
export async function listarVersoes(documentId: string): Promise<VersaoResumo[]> {
  const { data, error } = await supabase
    .from("document_versions")
    .select("id, version_number, original_name, mime_type, size_bytes, created_at, uploaded_by")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });

  if (error) throw new Error("Não foi possível carregar o histórico de versões.");
  return (data ?? []) as VersaoResumo[];
}

/**
 * URL assinada de validade curta. Usar na hora e descartar — não guardar em
 * estado global, cache ou localStorage: é uma credencial de leitura.
 */
export async function urlDoDocumento(versionId: string): Promise<string> {
  const token = await tokenDaSessao();

  const resp = await fetch(`${BASE}/functions/v1/documento-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: APIKEY,
    },
    body: JSON.stringify({ version_id: versionId }),
  });

  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(corpo.error ?? "Não foi possível abrir o arquivo.");
  return corpo.url as string;
}

/** Exclusão lógica: some das listagens, versões e arquivos ficam. */
export async function excluirDocumento(documentId: string): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) throw new Error("Não foi possível remover o documento.");
}
