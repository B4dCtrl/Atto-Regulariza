import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { urlDoDocumento, type VersaoResumo } from "@/lib/api/documentos";

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Visualização do arquivo. A URL assinada é pedida ao abrir, não na listagem:
 * a validade de 5 minutos começa a contar quando o arquivo é realmente aberto.
 *
 * A URL fica só em estado local e some ao fechar — nada de cache do TanStack
 * Query, estado global ou storage: ela é credencial de leitura, não dado.
 *
 * A casca é o Dialog do Radix (já usado no projeto), que entrega armadilha de
 * foco, devolução do foco ao fechar, Escape e ARIA prontos. Implementar isso à
 * mão sairia pela metade — o Tab escaparia para a página atrás do modal.
 */
export function DocumentPreview({
  versao,
  onFechar,
}: {
  versao: VersaoResumo | null;
  onFechar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  // Depende do id, não do objeto: se o pai recriar o objeto a cada render
  // (um .find() inline, por exemplo), depender do objeto pediria uma URL
  // assinada nova a cada render.
  const versaoId = versao?.id ?? null;

  useEffect(() => {
    if (!versaoId) {
      setUrl(null);
      setErro(null);
      return;
    }
    // A flag evita escrever estado depois que o modal fechou ou trocou de
    // versão: sem ela, a resposta lenta da versão anterior sobrescreveria a
    // nova e mostraria o arquivo errado por um instante.
    let cancelado = false;
    setUrl(null);
    setErro(null);
    urlDoDocumento(versaoId)
      .then((u) => {
        if (!cancelado) setUrl(u);
      })
      .catch((e: Error) => {
        if (!cancelado) setErro(e.message);
      });
    return () => {
      cancelado = true;
    };
  }, [versaoId]);

  /**
   * Download por fetch + blob, e não por `<a href={urlAssinada} download>`:
   * o href colocaria a URL assinada no histórico do navegador e no cabeçalho
   * Referer, e ela seguiria valendo até expirar. O `blob:` é local à aba,
   * não vaza para lugar nenhum e é revogado logo após o clique.
   */
  const baixar = useCallback(async () => {
    if (!url || !versao) return;
    setBaixando(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Não foi possível baixar o arquivo.");
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = versao.original_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // O revoke precisa esperar o navegador iniciar o download; sem o atraso
      // o Safari cancela. Revogar sempre — senão o blob fica retido em memória
      // a cada arquivo baixado.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível baixar o arquivo.");
    } finally {
      setBaixando(false);
    }
  }, [url, versao]);

  if (!versao) return null;

  const ehImagem = versao.mime_type.startsWith("image/");

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3 pr-12">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-medium">
              {versao.original_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-soft">
              versão {versao.version_number} · {tamanhoLegivel(versao.size_bytes)} ·{" "}
              {new Date(versao.created_at).toLocaleDateString("pt-BR")}
            </DialogDescription>
          </div>
          {url && (
            <button
              type="button"
              onClick={baixar}
              disabled={baixando}
              className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface disabled:opacity-50"
              title="Baixar"
              aria-label="Baixar arquivo"
            >
              {baixando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-auto bg-surface/40">
          {erro ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <AlertCircle className="h-6 w-6 text-ink-soft" />
              <p className="text-sm text-ink-soft">{erro}</p>
            </div>
          ) : !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
          ) : ehImagem ? (
            <img
              src={url}
              alt={versao.original_name}
              className="max-h-[80vh] max-w-full object-contain"
            />
          ) : (
            <iframe src={url} title={versao.original_name} className="h-[80vh] w-full border-0" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
