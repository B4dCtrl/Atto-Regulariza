import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
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
}: {
  onAbrirProcesso?: (propertyId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

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
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

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

      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
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
                      <span className={`block text-sm ${n.lida ? "text-ink-soft" : "font-medium"}`}>
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
        </div>
      )}
    </div>
  );
}
