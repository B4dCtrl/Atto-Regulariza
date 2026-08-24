import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UploadDocumento } from "@/components/documentos/UploadDocumento";
import { rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import { CHECKLIST_PADRAO, faltamDoChecklist, type DocumentoResumo } from "@/lib/checklist-inicial";

/**
 * O que o cliente faz logo depois do tutorial.
 *
 * Antes desta tela, o tutorial terminava e a pessoa caía no painel sem
 * instrução nenhuma — podia nunca enviar documento algum, e o processo ficava
 * parado sem ninguém perceber.
 *
 * É tela, não modal: modal se fecha e nunca mais volta. E tem saída — prender
 * alguém numa tela sem escapatória faz fechar a aba, e aí perde-se o cliente
 * inteiro em vez de um documento. Quem sai reencontra os mesmos itens em
 * "O que falta de você".
 */
export function ProtocoloInicial({
  propertyId,
  aoSair,
}: {
  propertyId: string;
  aoSair: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    supabase
      .from("documents")
      .select("kind, status, deleted_at")
      .eq("property_id", propertyId)
      .then(({ data }) => {
        setDocs((data ?? []) as DocumentoResumo[]);
        setCarregando(false);
      });
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const faltam = faltamDoChecklist(docs);
  const enviados = CHECKLIST_PADRAO.length - faltam.length;
  const completo = faltam.length === 0;

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface/40">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (completo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface/40 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-background p-8 text-center ring-1 ring-border">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10">
            <Check className="h-5 w-5 text-accent" />
          </span>
          <h1 className="mt-5 font-serif text-2xl">Recebemos seus documentos.</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Nossa equipe está conferindo. Em até 2 dias úteis você recebe aqui a lista do que ainda
            falta para o seu caso.
          </p>
          <button
            type="button"
            onClick={aoSair}
            className="mt-6 rounded-xl bg-foreground px-5 py-2.5 text-sm text-background"
          >
            Ir para o meu painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface/40 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="font-serif text-3xl leading-tight">Vamos começar pelos documentos</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Com esses três em mãos, nossa equipe consegue analisar seu caso e dizer exatamente o que
          falta. Sem eles, seu processo não sai do lugar.
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Leva 2 minutos se você já tiver os arquivos no celular.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(enviados / CHECKLIST_PADRAO.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-ink-soft">
            {enviados} de {CHECKLIST_PADRAO.length} enviados
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {CHECKLIST_PADRAO.map((kind) => {
            const pendente = faltam.includes(kind);
            return (
              <div
                key={kind}
                className={`rounded-2xl p-4 ring-1 ${
                  pendente ? "bg-background ring-border" : "bg-accent/5 ring-accent/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {pendente ? (
                    <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
                  ) : (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  )}
                  <span className="text-sm font-medium">{rotuloDoKind(kind)}</span>
                  {!pendente && <span className="ml-auto text-xs text-accent">enviado</span>}
                </div>

                {kind === "matricula" && pendente && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    Não tem a matrícula? Envie o contrato de compra e venda, ou pule este item —
                    muitos imóveis ainda não têm registro, e é justamente isso que vamos resolver.
                  </p>
                )}

                {pendente && (
                  <div className="mt-3">
                    <UploadDocumento
                      propertyId={propertyId}
                      origem="cliente"
                      tipoFixo={kind as DocumentKind}
                      onEnviado={carregar}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={aoSair}
          className="mt-6 w-full rounded-xl border border-border py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface"
        >
          Enviar depois
        </button>
      </div>
    </div>
  );
}
