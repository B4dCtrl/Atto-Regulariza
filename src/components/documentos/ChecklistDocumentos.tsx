import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listarDocumentos, type DocumentoComVersao, type VersaoResumo } from "@/lib/api/documentos";
import { criarPendencia } from "@/lib/api/pendencias";
import { kindsPara, rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import { DocumentPreview } from "./DocumentPreview";

/**
 * Conferência dos documentos do cliente.
 *
 * Antes isto era uma lista fixa de seis itens no `localStorage`, sem qualquer
 * relação com os arquivos: marcar "IPTU atualizado" não significava que o IPTU
 * tinha chegado. Agora a lista É a dos documentos do processo, em três estados:
 *
 *   não enviado  → opaco, com botão de pedir ao cliente
 *   enviado      → abre o arquivo, e a caixa marca como conferido
 *   conferido    → `documents.status = 'Aprovado'`
 *
 * A marcação usa a coluna `status`, que já existia — nenhuma estrutura nova, e
 * impossível a conferência divergir da realidade.
 */
export function ChecklistDocumentos({
  propertyId,
  recarregarToken = 0,
  onMudou,
}: {
  propertyId: string;
  recarregarToken?: number;
  onMudou?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoComVersao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [preview, setPreview] = useState<VersaoResumo | null>(null);
  const [pedidos, setPedidos] = useState<string[]>([]);

  const carregar = useCallback(() => {
    setCarregando(true);
    listarDocumentos(propertyId)
      .then(setDocs)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregarToken]);

  // Só os tipos que o cliente envia: a conferência é do que ELE entregou.
  const tipos = kindsPara("cliente").filter((t) => t.kind !== "outro");

  async function alternarConferido(doc: DocumentoComVersao) {
    const novo = doc.status === "Aprovado" ? "Enviado" : "Aprovado";
    setOcupado(doc.id);
    setErro(null);
    const { error } = await supabase.from("documents").update({ status: novo }).eq("id", doc.id);
    setOcupado(null);

    if (error) {
      setErro("Não foi possível registrar a conferência.");
      return;
    }
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, status: novo } : d)));
    onMudou?.();
  }

  async function solicitar(kind: DocumentKind) {
    setOcupado(kind);
    setErro(null);
    try {
      await criarPendencia({
        propertyId,
        descricao: `Envie: ${rotuloDoKind(kind)}`,
        kind,
      });
      setPedidos((p) => [...p, kind]);
      onMudou?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pedir o documento.");
    } finally {
      setOcupado(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex h-20 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  return (
    <>
      {erro && (
        <div role="alert" className="mb-3 flex gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {tipos.map((t) => {
          // Documento removido não conta como entregue: `listarDocumentos`
          // devolve os excluídos para a equipe poder distingui-los.
          const doc = docs.find(
            (d) => d.kind === t.kind && d.origem === "cliente" && !d.deleted_at,
          );
          const enviado = !!doc?.versao;
          const conferido = doc?.status === "Aprovado";
          const jaPedido = pedidos.includes(t.kind);
          const processando = ocupado === (doc?.id ?? t.kind);

          return (
            <div
              key={t.kind}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                enviado ? "bg-background ring-1 ring-border" : "bg-surface/40"
              }`}
            >
              <button
                type="button"
                onClick={() => doc && alternarConferido(doc)}
                disabled={!enviado || processando}
                aria-label={conferido ? "Desmarcar conferência" : "Marcar como conferido"}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 transition-colors ${
                  conferido ? "bg-foreground text-background ring-foreground" : "ring-border"
                } ${enviado ? "" : "cursor-not-allowed opacity-40"}`}
              >
                {processando ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : conferido ? (
                  <Check className="h-3 w-3" />
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => doc?.versao && setPreview(doc.versao)}
                disabled={!enviado}
                className={`min-w-0 flex-1 text-left ${enviado ? "" : "cursor-default"}`}
              >
                <div className={`truncate text-sm ${enviado ? "" : "text-ink-soft"}`}>
                  {t.label}
                </div>
                <div className="truncate text-xs text-ink-soft">
                  {enviado ? (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {doc?.versao?.original_name}
                      {conferido && " · conferido"}
                    </span>
                  ) : (
                    "ainda não enviado"
                  )}
                </div>
              </button>

              {!enviado && (
                <button
                  type="button"
                  onClick={() => solicitar(t.kind)}
                  disabled={jaPedido || processando}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:border-foreground/30 disabled:opacity-50"
                >
                  {processando ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {jaPedido ? "Pedido" : "Solicitar"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <DocumentPreview versao={preview} onFechar={() => setPreview(null)} />
    </>
  );
}
