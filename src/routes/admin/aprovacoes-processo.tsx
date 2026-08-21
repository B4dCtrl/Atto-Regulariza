import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, X, Loader2, Inbox, ShieldCheck, Trash2, Flag, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listarAprovacoesPendentes, decidirAprovacao, type Aprovacao } from "@/lib/api/aprovacoes";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/aprovacoes-processo")({
  head: () => ({ meta: [{ title: "Aprovações de processo — Gestão Regulariza" }] }),
  component: AprovacoesProcessoPage,
});

/** Nome do processo, de quem pediu e do documento, para o admin decidir com contexto. */
interface Contexto {
  processo: string;
  solicitante: string;
  documento: string | null;
}

function AprovacoesProcessoPage() {
  const [pedidos, setPedidos] = useState<Aprovacao[]>([]);
  const [ctx, setCtx] = useState<Record<string, Contexto>>({});
  const [carregando, setCarregando] = useState(true);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Pedido aguardando o motivo da recusa.
   *
   * Usamos AlertDialog em vez de window.prompt() pelo mesmo motivo concreto que
   * já nos fez trocar confirm() na lista de documentos: no Chrome o usuário pode
   * marcar "não exibir mais diálogos", e a partir daí prompt() devolve null para
   * sempre — o botão de recusar pararia de funcionar sem nenhum aviso.
   */
  const [recusando, setRecusando] = useState<Aprovacao | null>(null);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarAprovacoesPendentes();
      setPedidos(lista);

      if (lista.length === 0) {
        setCtx({});
        return;
      }

      // Contexto numa consulta por tabela, em vez de uma por pedido. As listas
      // vazias são checadas antes: `.in("id", [""])` faria o Postgres recusar
      // '' como uuid, e a consulta voltaria só com erro — busca inútil.
      const propIds = [...new Set(lista.map((p) => p.property_id))];
      const userIds = [...new Set(lista.map((p) => p.solicitado_por).filter(Boolean))] as string[];
      const docIds = [...new Set(lista.map((p) => p.document_id).filter(Boolean))] as string[];

      const [{ data: props }, { data: perfis }, { data: docs }] = await Promise.all([
        propIds.length
          ? supabase.from("properties").select("id, name").in("id", propIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        userIds.length
          ? supabase.from("profiles").select("id, name").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
        docIds.length
          ? supabase.from("documents").select("id, name").in("id", docIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

      const nomeProc = new Map((props ?? []).map((p) => [p.id, p.name]));
      const nomeUser = new Map((perfis ?? []).map((p) => [p.id, p.name ?? "—"]));
      const nomeDoc = new Map((docs ?? []).map((d) => [d.id, d.name]));

      setCtx(
        Object.fromEntries(
          lista.map((p) => [
            p.id,
            {
              processo: nomeProc.get(p.property_id) ?? "Processo",
              solicitante: p.solicitado_por ? (nomeUser.get(p.solicitado_por) ?? "—") : "—",
              // Documento já removido da lista ainda tem linha; se sumir de vez,
              // dizemos isso em vez de deixar o admin decidir no escuro.
              documento: p.document_id
                ? (nomeDoc.get(p.document_id) ?? "documento não encontrado")
                : null,
            },
          ]),
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os pedidos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(p: Aprovacao, aprovado: boolean, motivoRecusa?: string) {
    setDecidindo(p.id);
    setErro(null);
    try {
      await decidirAprovacao(p.id, aprovado, motivoRecusa);
      setPedidos((ps) => ps.filter((x) => x.id !== p.id));
    } catch (e) {
      // A camada de API distingue "outro admin já decidiu" da falha genérica.
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a decisão.");
      carregar();
    } finally {
      setDecidindo(null);
    }
  }

  function confirmarRecusa() {
    const p = recusando;
    if (!p) return;
    const texto = motivo.trim();
    setRecusando(null);
    setMotivo("");
    decidir(p, false, texto || undefined);
  }

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-ink-soft">
          Gestão · Processos
        </div>
        <h1 className="font-serif text-3xl tracking-tight">Aprovações de processo</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Concluir um processo e excluir documento dependem do seu aval. A regra é imposta pelo
          banco: sem aprovação aqui, o profissional não consegue fazer nem por fora do site.
        </p>
      </div>

      {erro && (
        <div
          role="alert"
          className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"
        >
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-3xl bg-background p-16 text-center ring-1 ring-border">
          <Inbox className="mx-auto h-7 w-7 text-ink-soft" />
          <p className="mt-3 text-sm text-ink-soft">Nenhum pedido aguardando decisão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => {
            const c = ctx[p.id];
            const ehConclusao = p.tipo === "conclusao";
            const Icone = ehConclusao ? Flag : Trash2;

            return (
              <div key={p.id} className="rounded-2xl bg-background p-5 ring-1 ring-border">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3.5">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
                      <Icone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {ehConclusao ? "Concluir o processo" : "Excluir um documento"}
                      </div>
                      <div className="mt-0.5 text-sm text-ink-soft">
                        {c?.processo} · pedido por {c?.solicitante}
                      </div>
                      {c?.documento && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-soft">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.documento}</span>
                        </div>
                      )}
                      {p.justificativa && (
                        <div className="mt-2 rounded-xl bg-surface/60 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                          {p.justificativa}
                        </div>
                      )}
                      <div className="mt-1.5 text-[11px] text-ink-soft/70">
                        {new Date(p.solicitado_em).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => decidir(p, true)}
                      disabled={decidindo === p.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {decidindo === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMotivo("");
                        setRecusando(p);
                      }}
                      disabled={decidindo === p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Cada aprovação vale uma vez. Aprovar de novo o mesmo processo exige pedido novo.
      </p>

      <AlertDialog
        open={!!recusando}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setRecusando(null);
            setMotivo("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Escreva o motivo: o profissional recebe esta mensagem e é por ela que ele saberá o que
              precisa corrigir antes de pedir de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Motivo da recusa"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRecusa}>Recusar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
