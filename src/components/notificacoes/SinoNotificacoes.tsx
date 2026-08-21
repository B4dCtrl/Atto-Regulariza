import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Bell,
  Check,
  FileText,
  Loader2,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
  type Notificacao,
} from "@/lib/api/notificacoes";

const ICONE: Record<string, ElementType> = {
  mensagem: MessageSquare,
  documento: FileText,
  pendencia: AlertCircle,
  aprovacao: ShieldCheck,
};

function quandoFoi(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Sino com contador e lista.
 *
 * Nada é criado aqui: as notificações nascem de gatilhos no banco quando chega
 * mensagem, documento, pendência ou pedido de aprovação. Este componente só lê
 * e marca como lida.
 */
export function SinoNotificacoes({
  onAbrirProcesso,
  ancoragem = "superior-direita",
}: {
  onAbrirProcesso?: (propertyId: string) => void;
  /**
   * De que canto o painel cresce.
   *
   * O padrão serve a sino no topo da tela, à direita. No rodapé da barra
   * lateral os dois eixos se invertem: crescer para a esquerda joga os 320px
   * para fora da janela, e crescer para baixo joga para fora do rodapé.
   */
  ancoragem?: "superior-direita" | "inferior-esquerda";
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);

  // O canal só avisa; quem lê o estado atual é o efeito. Guardar "aberto" num
  // ref evita reassinar o canal a cada abre-e-fecha do sino.
  const abertoRef = useRef(false);
  abertoRef.current = aberto;

  const carregar = useCallback(() => {
    setCarregando(true);
    listarNotificacoes()
      .then(setItens)
      .catch(() => setItens([]))
      .finally(() => setCarregando(false));
  }, []);

  const atualizarContador = useCallback(() => {
    contarNaoLidas().then(setNaoLidas);
  }, []);

  useEffect(() => {
    atualizarContador();

    // Numa conversa ativa cada mensagem gera um evento, e sem freio isso viraria
    // uma consulta de contagem por mensagem. O respiro de meio segundo agrupa a
    // rajada numa consulta só — o contador atrasa um instante, o que ninguém vê.
    let respiro: ReturnType<typeof setTimeout> | null = null;
    const aoMudar = () => {
      if (respiro) clearTimeout(respiro);
      respiro = setTimeout(() => {
        atualizarContador();
        if (abertoRef.current) carregar();
      }, 500);
    };

    // A assinatura é montada depois de saber quem está logado: o filtro por
    // user_id evita que o servidor sequer avalie eventos de linha alheia. A RLS
    // continua sendo a garantia — o filtro é economia, não segurança.
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (cancelado || !uid) return;
      canal = supabase
        .channel(`notificacoes:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          aoMudar,
        )
        .subscribe();
    });

    return () => {
      cancelado = true;
      if (respiro) clearTimeout(respiro);
      if (canal) supabase.removeChannel(canal);
    };
  }, [atualizarContador, carregar]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      const alvo = e.target as Node;
      // O painel é renderizado no body por portal: ele NÃO está dentro de
      // caixaRef, então clicar nele contaria como "clique fora" e fecharia o
      // menu antes do onClick do item rodar.
      if (caixaRef.current?.contains(alvo)) return;
      if (painelRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  // Posição em coordenadas de viewport, medida antes da pintura para o painel
  // não aparecer um quadro no canto errado. Reposiciona em rolagem e resize:
  // `fixed` não acompanha o botão sozinho.
  useLayoutEffect(() => {
    if (!aberto) return;

    function medir() {
      const b = botaoRef.current?.getBoundingClientRect();
      if (!b) return;
      const largura = Math.min(320, window.innerWidth - 32);
      const altura = painelRef.current?.offsetHeight ?? 400;

      if (ancoragem === "inferior-esquerda") {
        // Acima do botão e alinhado à esquerda dele; se não couber acima,
        // desce, e nunca passa das bordas da janela.
        const acima = b.top - altura - 8;
        setPosicao({
          top: acima >= 8 ? acima : Math.min(b.bottom + 8, window.innerHeight - altura - 8),
          left: Math.min(b.left, window.innerWidth - largura - 8),
        });
      } else {
        setPosicao({
          top: b.bottom + 8,
          left: Math.max(8, Math.min(b.right - largura, window.innerWidth - largura - 8)),
        });
      }
    }

    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, ancoragem, itens.length, carregando]);

  function alternar() {
    const novoEstado = !aberto;
    setAberto(novoEstado);
    if (novoEstado) carregar();
  }

  async function aoClicarItem(n: Notificacao) {
    if (!n.lida) {
      await marcarComoLida(n.id);
      setItens((is) => is.map((i) => (i.id === n.id ? { ...i, lida: true } : i)));
      atualizarContador();
    }
    if (n.property_id && onAbrirProcesso) {
      onAbrirProcesso(n.property_id);
      setAberto(false);
    }
  }

  async function lerTodas() {
    await marcarTodasComoLidas();
    setItens((is) => is.map((i) => ({ ...i, lida: true })));
    setNaoLidas(0);
  }

  return (
    <div ref={caixaRef} className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-label={naoLidas > 0 ? `${naoLidas} notificações não lidas` : "Notificações"}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-background transition-colors hover:bg-surface"
      >
        <Bell className="h-4 w-4 text-ink-soft" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {/* Portal para o body.
          A barra lateral do profissional tem `overflow-hidden` — necessário
          para a animação de expandir no hover — e isso recortava o painel na
          largura dela. Nenhum ajuste de posicionamento resolve dentro do pai:
          o corte acontece no pai. Fora da árvore, `fixed` posiciona pela
          janela e nada recorta. */}
      {aberto &&
        createPortal(
          <div
            ref={painelRef}
            style={{
              top: posicao?.top ?? -9999,
              left: posicao?.left ?? -9999,
              visibility: posicao ? "visible" : "hidden",
            }}
            className="fixed z-[60] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="text-sm font-medium">Notificações</span>
              {naoLidas > 0 && (
                <button
                  type="button"
                  onClick={lerTodas}
                  className="ml-auto text-xs text-ink-soft hover:text-foreground"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {carregando ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
                </div>
              ) : itens.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Check className="mx-auto h-5 w-5 text-ink-soft" />
                  <p className="mt-2 text-xs text-ink-soft">Nenhuma novidade.</p>
                </div>
              ) : (
                itens.map((n) => {
                  const Icone = ICONE[n.tipo] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => aoClicarItem(n)}
                      className={`flex w-full gap-2.5 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface ${
                        n.lida ? "" : "bg-accent/5"
                      }`}
                    >
                      <Icone
                        className={`mt-0.5 h-4 w-4 shrink-0 ${n.lida ? "text-ink-soft" : "text-accent"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm ${n.lida ? "text-ink-soft" : "font-medium"}`}
                        >
                          {n.titulo}
                        </span>
                        {n.corpo && (
                          <span className="mt-0.5 block truncate text-xs text-ink-soft">
                            {n.corpo}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-ink-soft/70">
                          {quandoFoi(n.criada_em)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
