import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { PERGUNTAS_FREQUENTES, type PerguntaFrequente } from "@/lib/perguntas-frequentes";

/**
 * Oferece a assistente enquanto o cliente espera a equipe.
 *
 * Quem abre o chat e não recebe resposta na hora fica sem saber se alguém viu.
 * A assistente não substitui o profissional — não decide nada sobre o caso —,
 * mas responde as dúvidas que não dependem de decisão nenhuma, e isso já tira a
 * pessoa do vazio.
 *
 * Aparece só quando faz sentido: com o profissional respondendo, some. E dá para
 * fechar — oferta que não pode ser recusada vira estorvo.
 */
export function OfertaAssistente({
  nomeProfissional,
  aoEscolher,
}: {
  /** Nulo quando ainda não há profissional designado. */
  nomeProfissional: string | null;
  aoEscolher: (p: PerguntaFrequente) => void;
}) {
  const [fechada, setFechada] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  if (fechada) return null;

  const mostradas = verTodas ? PERGUNTAS_FREQUENTES : PERGUNTAS_FREQUENTES.slice(0, 3);

  return (
    <div className="mx-4 mb-3 rounded-2xl bg-accent/5 p-4 ring-1 ring-accent/20">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/15">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Posso adiantar alguma dúvida?</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {nomeProfissional
              ? `${nomeProfissional} responde as questões do seu caso. Enquanto isso, eu explico como funciona o processo, quais documentos entram e o que acontece em cada etapa.`
              : "A equipe está designando o profissional do seu caso. Enquanto isso, eu explico como funciona o processo, quais documentos entram e o que acontece em cada etapa."}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {mostradas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => aoEscolher(p)}
                className="rounded-full bg-background px-3 py-1.5 text-[11px] ring-1 ring-border transition-colors hover:ring-foreground/30"
              >
                {p.pergunta}
              </button>
            ))}
            {!verTodas && PERGUNTAS_FREQUENTES.length > 3 && (
              <button
                type="button"
                onClick={() => setVerTodas(true)}
                className="rounded-full px-3 py-1.5 text-[11px] text-ink-soft underline"
              >
                ver mais
              </button>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
            Para qualquer outra coisa, escreva abaixo — respondo na hora e{" "}
            {nomeProfissional ?? "o profissional"} lê a conversa inteira.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFechada(true)}
          aria-label="Fechar oferta de ajuda"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
