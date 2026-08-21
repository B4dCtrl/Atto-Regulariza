import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, History, Loader2, Trash2, Inbox, Undo2 } from "lucide-react";
import {
  listarDocumentos,
  listarVersoes,
  excluirDocumento,
  restaurarDocumento,
  type DocumentoComVersao,
  type VersaoResumo,
} from "@/lib/api/documentos";
import { rotuloDoKind } from "@/lib/document-kinds";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DocumentPreview } from "./DocumentPreview";

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function DocumentList({
  propertyId,
  /** Histórico é conversa interna: só profissional e admin. */
  mostrarHistorico = false,
  podeExcluir = false,
  recarregarToken = 0,
}: {
  propertyId: string;
  mostrarHistorico?: boolean;
  podeExcluir?: boolean;
  recarregarToken?: number;
}) {
  const [docs, setDocs] = useState<DocumentoComVersao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** Erro de ação (excluir, abrir histórico). Separado de `erro` porque não
   *  deve apagar a lista já carregada — o usuário precisa continuar vendo o
   *  documento que tentou remover. */
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [preview, setPreview] = useState<VersaoResumo | null>(null);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<VersaoResumo[]>([]);
  /**
   * Documento aguardando confirmação de remoção.
   *
   * Usamos AlertDialog em vez de window.confirm() por um motivo concreto: no
   * Chrome o usuário pode marcar "não exibir mais diálogos", e a partir daí
   * confirm() devolve false para sempre — o botão de excluir pararia de
   * funcionar sem nenhum aviso. Falha silenciosa é pior que diálogo feio.
   */
  const [docParaExcluir, setDocParaExcluir] = useState<DocumentoComVersao | null>(null);
  /** Id em restauração — trava o botão para não disparar duas vezes. */
  const [restaurando, setRestaurando] = useState<string | null>(null);
  /** Último histórico pedido — descarta resposta que chega fora de ordem. */
  const historicoPedidoRef = useRef<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    listarDocumentos(propertyId)
      .then(setDocs)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregarToken]);

  async function abrirHistorico(documentId: string) {
    if (historicoDe === documentId) {
      historicoPedidoRef.current = null;
      setHistoricoDe(null);
      return;
    }
    historicoPedidoRef.current = documentId;
    setHistoricoDe(documentId);
    // Limpa antes de buscar: sem isso, abrir o histórico de um documento logo
    // depois de outro mostraria as versões do anterior até a resposta chegar.
    setVersoes([]);
    setErroAcao(null);
    try {
      const lista = await listarVersoes(documentId);
      // A resposta pode chegar fora de ordem (rede lenta em um clique, rápida
      // no seguinte). Só aplica se ainda for o documento aberto.
      if (historicoPedidoRef.current !== documentId) return;
      setVersoes(lista);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
    }
  }

  async function confirmarExclusao() {
    const documentId = docParaExcluir?.id;
    if (!documentId) return;
    setDocParaExcluir(null);
    setErroAcao(null);
    try {
      await excluirDocumento(documentId);
      carregar();
    } catch (e) {
      // Sem isto a promessa rejeitava em silêncio: o documento continuava na
      // tela e o usuário não sabia se a remoção falhou ou não tinha aplicado.
      setErroAcao(e instanceof Error ? e.message : "Não foi possível remover o documento.");
    }
  }

  async function aoRestaurar(d: DocumentoComVersao) {
    setRestaurando(d.id);
    setErroAcao(null);
    try {
      const restaurou = await restaurarDocumento(d.id);
      // `false` significa que já não havia o que restaurar — outra pessoa
      // desfez antes. Recarregar mostra o estado real em vez de insistir num
      // erro que não existe mais.
      if (!restaurou) setErroAcao("Este documento já havia sido restaurado.");
      carregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível restaurar o documento.");
    } finally {
      setRestaurando(null);
    }
  }

  // Spinner só na primeira carga. Nas recargas (após um envio) a lista antiga
  // continua visível: trocá-la por um spinner faria o conteúdo sumir e voltar,
  // com salto de layout, a cada arquivo enviado.
  if (carregando && docs.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (erro) {
    return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>;
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-2xl bg-surface/50 p-8 text-center">
        <Inbox className="mx-auto h-6 w-6 text-ink-soft" />
        <p className="mt-2 text-sm text-ink-soft">Nenhum documento enviado ainda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {erroAcao && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {erroAcao}
          </div>
        )}

        {docs.map((d) => (
          <div key={d.id} className="rounded-xl bg-background p-3 ring-1 ring-border">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
              <button
                type="button"
                onClick={() => d.versao && setPreview(d.versao)}
                disabled={!d.versao}
                className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
              >
                <div className="truncate text-sm font-medium">
                  {d.versao?.original_name ?? d.name}
                </div>
                <div className="text-xs text-ink-soft">
                  {rotuloDoKind(d.kind)}
                  {d.versao && ` · ${tamanhoLegivel(d.versao.size_bytes)}`}
                  {d.versao && ` · ${new Date(d.versao.created_at).toLocaleDateString("pt-BR")}`}
                  {!d.versao && " · aguardando envio do arquivo"}
                </div>
              </button>

              {/* Documento removido só chega à equipe (a RLS o esconde do
                  cliente). Sem esta marca o profissional não distingue um
                  documento ativo de um que ele mesmo removeu. */}
              {d.deleted_at && (
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-widest text-ink-soft">
                  removido
                </span>
              )}

              {/* Restaurar aparece no lugar de excluir: as duas ações são a
                  mesma coluna em estados opostos, e mostrar as duas juntas
                  convidaria a excluir o que se acabou de recuperar. */}
              {podeExcluir && d.deleted_at && (
                <button
                  type="button"
                  disabled={restaurando === d.id}
                  onClick={() => aoRestaurar(d)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-soft hover:bg-surface disabled:opacity-50"
                  title="Devolver à lista"
                >
                  {restaurando === d.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Undo2 className="h-3 w-3" />
                  )}
                  Restaurar
                </button>
              )}

              {mostrarHistorico && d.versao && d.versao.version_number > 1 && (
                <button
                  type="button"
                  onClick={() => abrirHistorico(d.id)}
                  aria-expanded={historicoDe === d.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-soft hover:bg-surface"
                >
                  <History className="h-3 w-3" /> v{d.versao.version_number} · histórico
                </button>
              )}

              {podeExcluir && !d.deleted_at && (
                <button
                  type="button"
                  onClick={() => setDocParaExcluir(d)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface"
                  title="Remover da lista"
                  aria-label="Remover da lista"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {historicoDe === d.id && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {versoes.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setPreview(v)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-soft hover:bg-surface"
                  >
                    <span className="font-medium">v{v.version_number}</span>
                    <span className="truncate">{v.original_name}</span>
                    <span className="ml-auto shrink-0">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <DocumentPreview versao={preview} onFechar={() => setPreview(null)} />

      <AlertDialog
        open={docParaExcluir !== null}
        onOpenChange={(aberto) => !aberto && setDocParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este documento da lista?</AlertDialogTitle>
            <AlertDialogDescription>
              {docParaExcluir?.versao?.original_name ?? docParaExcluir?.name} sai da listagem, mas o
              arquivo e o histórico de versões continuam guardados — nada é apagado de verdade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
