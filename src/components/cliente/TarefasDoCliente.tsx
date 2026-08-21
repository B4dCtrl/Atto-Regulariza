import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, Upload } from "lucide-react";
import { listarPendencias, textoDaPendencia, type Pendencia } from "@/lib/api/pendencias";
import { UploadDocumento } from "@/components/documentos/UploadDocumento";
import type { DocumentKind } from "@/lib/document-kinds";

/**
 * O que a equipe está esperando do cliente.
 *
 * Antes, a pendência que o profissional registrava morria no navegador dele: o
 * cliente nunca sabia. Agora ela aparece aqui como tarefa, e quando traz um
 * tipo de documento vem com o envio embutido — o cliente não escolhe nada, só
 * manda o arquivo.
 *
 * Não há botão de "concluir tarefa": um gatilho no banco fecha a pendência
 * quando chega documento do tipo pedido. O cliente vê a tarefa sumir sozinha,
 * que é o retorno que o faz agir da próxima vez.
 */
export function TarefasDoCliente({
  propertyId,
  recarregarToken = 0,
  onMudou,
}: {
  propertyId: string;
  recarregarToken?: number;
  onMudou?: () => void;
}) {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    listarPendencias(propertyId, true)
      .then(setPendencias)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregarToken]);

  if (carregando) {
    return (
      <div className="flex h-16 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-background/50" />
      </div>
    );
  }

  if (erro) {
    return <p className="text-sm text-background/70">{erro}</p>;
  }

  if (pendencias.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-background/70">
        <Check className="h-4 w-4 shrink-0" />
        Nada pendente da sua parte no momento.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pendencias.map((p) => {
        const expandida = aberta === p.id;
        const temEnvio = !!p.kind;

        return (
          <div key={p.id} className="rounded-2xl bg-background/10 p-3">
            <button
              type="button"
              onClick={() => temEnvio && setAberta(expandida ? null : p.id)}
              disabled={!temEnvio}
              className="flex w-full items-start gap-2.5 text-left"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-background/70" />
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-background">
                {textoDaPendencia(p)}
              </span>
              {temEnvio && (
                <ChevronDown
                  className={`mt-0.5 h-4 w-4 shrink-0 text-background/60 transition-transform ${
                    expandida ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {temEnvio && !expandida && (
              <button
                type="button"
                onClick={() => setAberta(p.id)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs text-accent-foreground"
              >
                <Upload className="h-3 w-3" /> Enviar agora
              </button>
            )}

            {temEnvio && expandida && (
              <div className="mt-3">
                {/* O tipo já vem definido pela pendência: o cliente não escolhe.
                    Assim que o arquivo chega, o gatilho no banco fecha a tarefa. */}
                <UploadDocumento
                  propertyId={propertyId}
                  origem="cliente"
                  tipoFixo={p.kind as DocumentKind}
                  onEnviado={() => {
                    setAberta(null);
                    carregar();
                    onMudou?.();
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
