import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { gerarBriefing, type Briefing, type ItemFila } from "@/lib/api/briefing.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";

const DESTINO: Record<string, string> = {
  aprovacoes: "/admin/aprovacoes",
  processos: "/admin/processos",
  leads: "/admin/leads",
};

/**
 * O que exige ação agora.
 *
 * Substituiu um chat que respondia dúvidas gerais sobre regularização —
 * conhecimento que o admin já tem, sobre a operação alheia. Aqui a IA lê os
 * dados do próprio sistema.
 *
 * Os números NÃO vêm da IA: `briefing.dados` é lido do banco a cada abertura e
 * exibido ao lado do texto. Se o texto (que é do dia) discordar da lista (que é
 * de agora), a diferença fica visível na mesma tela.
 */
export function PainelGerencial() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (forcar: boolean) => {
    setCarregando(true);
    setErro(null);
    try {
      const b = await gerarBriefing({ data: { forcar }, headers: await cabecalhoAuth() });
      setBriefing(b);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a análise.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(false);
  }, [carregar]);

  const d = briefing?.dados;
  const totalTarefas =
    (d?.profissionaisPendentes.length ?? 0) +
    (d?.aprovacoesPendentes.length ?? 0) +
    (d?.processosParados.length ?? 0) +
    (d?.leadsSemResposta.length ?? 0) +
    (d?.profissionaisInativos.length ?? 0);

  return (
    <section className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-none">O que exige você agora</div>
          {briefing && (
            <div className="mt-1 text-[11px] text-ink-soft">
              Análise de{" "}
              {new Date(briefing.gerado_em).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => carregar(true)}
          disabled={carregando}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-soft hover:bg-surface disabled:opacity-50"
        >
          {carregando ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Atualizar
        </button>
      </div>

      {carregando && !briefing ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
        </div>
      ) : (
        <>
          {/* Briefing escrito */}
          {briefing?.texto && <p className="mt-4 text-sm leading-relaxed">{briefing.texto}</p>}

          {/* A análise pode falhar sem levar o painel junto: as listas abaixo
              vêm do banco e continuam corretas. */}
          {(erro || briefing?.erroIA) && (
            <div className="mt-4 flex gap-2 rounded-xl bg-surface p-3 text-xs text-ink-soft">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{erro ?? briefing?.erroIA}</span>
            </div>
          )}

          {/* Fila priorizada */}
          {briefing && briefing.fila.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {briefing.fila.map((item: ItemFila, i: number) => (
                <li key={i}>
                  {/* Link, não <a>.
                      Com <a> o navegador recarrega a página inteira, e aí o
                      beforeLoad da rota roda NO SERVIDOR, onde
                      supabase.auth.getSession() não enxerga nada — a sessão
                      vive no localStorage. Sem sessão, a rota redirecionava
                      para /entrar: clicar numa tarefa deslogava o admin. */}
                  <Link
                    to={DESTINO[item.destino] ?? "/admin/processos"}
                    className="flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-medium text-background">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{item.titulo}</span>
                      <span className="block text-xs text-ink-soft">{item.motivo}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Alertas */}
          {briefing && briefing.alertas.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">
                Saindo do radar
              </div>
              <ul className="mt-2 space-y-1">
                {briefing.alertas.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-ink-soft">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Os números crus, que não dependem da IA. */}
          {d && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-ink-soft">
              <span>{d.profissionaisPendentes.length} profissional(is) a liberar</span>
              <span>{d.aprovacoesPendentes.length} aprovação(ões) pendente(s)</span>
              <span>{d.processosParados.length} processo(s) parado(s)</span>
              <span>{d.leadsSemResposta.length} lead(s) sem resposta</span>
              <span>{d.profissionaisInativos.length} profissional(is) inativo(s)</span>
            </div>
          )}

          {totalTarefas === 0 && briefing?.fila.length === 0 && !erro && !briefing?.erroIA && briefing && (
            <p className="mt-4 text-sm text-ink-soft">Nada exige sua ação agora.</p>
          )}
        </>
      )}
    </section>
  );
}
