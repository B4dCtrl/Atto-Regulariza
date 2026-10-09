import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Clock, Hand, Loader2, MapPin } from "lucide-react";
import {
  listarSemAtribuicao,
  solicitarAtribuicao,
  type ProcessoSemAtribuicao,
} from "@/lib/api/pedidos-atribuicao";
import { rotuloDaSituacao, rotuloDoTipo } from "@/lib/aviso-cadastro";

/**
 * Casos que ainda não têm profissional, com o botão de pedir ao admin.
 *
 * O profissional vê o caso (tipo, cidade, situação, objetivo), não o cliente:
 * nome e contato só chegam quando o admin designa. Quem decide continua sendo
 * o admin — o pedido acende o sino dele.
 */
export function ProcessosSemAtribuicao() {
  const [lista, setLista] = useState<ProcessoSemAtribuicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState<string | null>(null);

  const carregar = useCallback(() => {
    listarSemAtribuicao()
      .then((l) => {
        setLista(l);
        setErro(null);
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function pedir(id: string) {
    setPedindo(id);
    setErro(null);
    try {
      await solicitarAtribuicao(id);
      setLista((l) => l.map((p) => (p.id === id ? { ...p, ja_pedi: true } : p)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o pedido.");
      carregar();
    } finally {
      setPedindo(null);
    }
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Disponíveis</div>
          <h2 className="font-serif text-2xl tracking-tight">Processos sem atribuição</h2>
        </div>
        {!carregando && (
          <span className="text-xs text-ink-soft">
            {lista.length} processo{lista.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {erro && (
        <div role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-soft">
          Nenhum processo esperando profissional agora.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl bg-background p-4 ring-1 ring-border"
            >
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-surface text-ink-soft">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium leading-tight">
                {rotuloDoTipo(p.tipo_imovel) || "Imóvel"}
              </div>
              {p.situacao && (
                <div className="mt-0.5 text-xs text-ink-soft">{rotuloDaSituacao(p.situacao)}</div>
              )}
              <div className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                <MapPin className="h-3 w-3" />
                {[p.city, p.state].filter(Boolean).join("/") || "Cidade não informada"}
              </div>
              {p.objetivo && <div className="mt-1 text-xs text-ink-soft">{p.objetivo}</div>}
              <div className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                <Clock className="h-3 w-3" />
                {new Date(p.criado_em).toLocaleDateString("pt-BR")}
              </div>

              <div className="mt-4 flex-1" />
              {p.ja_pedi ? (
                <div className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent/10 py-2 text-xs text-accent">
                  <Check className="h-3.5 w-3.5" />
                  Pedido enviado ao admin
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pedindo === p.id}
                  onClick={() => pedir(p.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground py-2 text-xs text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {pedindo === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Hand className="h-3.5 w-3.5" />
                  )}
                  Solicitar ao admin
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
