import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2, Send, AlertCircle } from "lucide-react";
import {
  listarDocumentos,
  marcarConferencia,
  type DocumentoComVersao,
  type VersaoResumo,
} from "@/lib/api/documentos";
import { criarPendencia, listarPendencias, type Pendencia } from "@/lib/api/pendencias";
import { kindsPara, rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import { DocumentPreview } from "./DocumentPreview";

/**
 * Conferência dos documentos do cliente.
 *
 * Antes isto era uma lista fixa de seis itens no `localStorage`, sem relação
 * com os arquivos: marcar "IPTU atualizado" não significava que o IPTU tinha
 * chegado. Agora a lista É a dos documentos do processo, em três estados:
 *
 *   não enviado  → opaco, com botão de pedir ao cliente
 *   enviado      → abre o arquivo, e a caixa marca como conferido
 *   conferido    → `documents.status = 'Aprovado'`
 *
 * Abaixo dos tipos conhecidos vem uma segunda lista, com o que o cliente
 * mandou sem se encaixar em nenhum deles — inclusive o tipo "outro", que é
 * justamente o que quem está confuso escolhe. Sem ela, o profissional não veria
 * esses arquivos e poderia pedir algo que já chegou.
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
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [preview, setPreview] = useState<VersaoResumo | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    // As pendências abertas vêm do banco, não de estado local: sem isso, o
    // profissional que recarregasse a página veria "Solicitar" de novo e criaria
    // uma segunda pendência do mesmo tipo — que o cliente veria duplicada.
    Promise.all([listarDocumentos(propertyId), listarPendencias(propertyId, true)])
      .then(([ds, ps]) => {
        setDocs(ds);
        setPendencias(ps);
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregarToken]);

  // Só os tipos que o cliente envia: a conferência é do que ELE entregou.
  const tipos = kindsPara("cliente").filter((t) => t.kind !== "outro");
  const tiposConhecidos = new Set<string>(tipos.map((t) => t.kind));

  const doDoCliente = (d: DocumentoComVersao) => d.origem === "cliente" && !d.deleted_at;

  /** Enviados pelo cliente que não casam com nenhum tipo da lista acima. */
  const semTipo = docs.filter((d) => doDoCliente(d) && !tiposConhecidos.has(d.kind));

  async function alternarConferido(doc: DocumentoComVersao) {
    const conferido = doc.status === "Aprovado";
    setOcupado(doc.id);
    setErro(null);
    try {
      await marcarConferencia(doc.id, !conferido);
      setDocs((ds) =>
        ds.map((d) => (d.id === doc.id ? { ...d, status: conferido ? "Enviado" : "Aprovado" } : d)),
      );
      onMudou?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a conferência.");
    } finally {
      setOcupado(null);
    }
  }

  async function solicitar(kind: DocumentKind) {
    setOcupado(kind);
    setErro(null);
    try {
      await criarPendencia({ propertyId, descricao: `Envie: ${rotuloDoKind(kind)}`, kind });
      // Recarrega do banco: a lista de pendências abertas é a verdade.
      setPendencias(await listarPendencias(propertyId, true));
      onMudou?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pedir o documento.");
    } finally {
      setOcupado(null);
    }
  }

  /** Uma linha da conferência, usada pelos tipos conhecidos e pelos avulsos. */
  function Linha({
    rotulo,
    doc,
    kind,
  }: {
    rotulo: string;
    doc?: DocumentoComVersao;
    kind?: DocumentKind;
  }) {
    const enviado = !!doc?.versao;
    const conferido = doc?.status === "Aprovado";
    const jaPedido = !!kind && pendencias.some((p) => p.kind === kind);
    const processando = ocupado === (doc?.id ?? kind);

    return (
      <div
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
          <div className={`truncate text-sm ${enviado ? "" : "text-ink-soft"}`}>{rotulo}</div>
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

        {!enviado && kind && (
          <button
            type="button"
            onClick={() => solicitar(kind)}
            disabled={jaPedido || processando}
            title={jaPedido ? "Já pedido ao cliente" : "Pedir este documento ao cliente"}
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
        {tipos.map((t) => (
          <Linha
            key={t.kind}
            rotulo={t.label}
            kind={t.kind}
            doc={docs.find((d) => doDoCliente(d) && d.kind === t.kind)}
          />
        ))}
      </div>

      {semTipo.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-ink-soft">
            Outros enviados pelo cliente
          </div>
          <div className="space-y-1.5">
            {semTipo.map((d) => (
              <Linha key={d.id} rotulo={rotuloDoKind(d.kind)} doc={d} />
            ))}
          </div>
        </div>
      )}

      <DocumentPreview versao={preview} onFechar={() => setPreview(null)} />
    </>
  );
}
