import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, PenSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listarEmails, abrirEmail } from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import type { ResumoEmail, EmailAberto } from "@/lib/api/mail-imap.server";
import { ENDERECOS, ROTULO, PADRAO, type Endereco } from "@/lib/mail/enderecos";
import { POR_PAGINA, type Pasta } from "@/lib/mail/validacao";
import { assuntoDeResposta, citar } from "@/lib/mail/resposta";
import { ListaEmails } from "@/components/admin/mail/ListaEmails";
import { LeitorEmail } from "@/components/admin/mail/LeitorEmail";
import { EditorEmail, type Rascunho } from "@/components/admin/mail/EditorEmail";

export const Route = createFileRoute("/admin/mail")({
  head: () => ({
    meta: [{ title: "E-mail — Ato Regulariza" }, { name: "robots", content: "noindex" }],
  }),
  component: MailPage,
});

function MailPage() {
  const [pasta, setPasta] = useState<Pasta>("entrada");
  const [alias, setAlias] = useState<Endereco | undefined>();
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<ResumoEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<EmailAberto | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  // Chave do <EditorEmail>: "novo" fixo fazia um segundo "Escrever" reusar o
  // estado (texto, destinatário) do rascunho anterior em vez de começar do
  // zero, porque a key não mudava entre um rascunho novo e outro.
  const rascunhoId = useRef(0);

  // Contadores de pedido em voo: IMAP demora segundos, e trocar de aba/filtro
  // ou clicar em dois e-mails rápido pode fazer a resposta mais lenta chegar
  // por último. Cada função só aplica sua resposta se ainda for a mais
  // recente — senão o "Enviados" mostraria itens da Entrada, ou um clique
  // reabriria o e-mail errado sob a aba nova.
  const cargaId = useRef(0);
  const abrirId = useRef(0);

  const carregar = useCallback(async () => {
    const id = ++cargaId.current;
    setCarregando(true);
    try {
      const r = await listarEmails({
        data: { pasta, pagina, alias },
        headers: await cabecalhoAuth(),
      });
      if (id !== cargaId.current) return; // uma chamada mais nova já respondeu
      setItens(r.itens);
      setTotal(r.total);
    } catch (e) {
      if (id !== cargaId.current) return;
      toast.error((e as Error).message);
    } finally {
      if (id === cargaId.current) setCarregando(false);
    }
  }, [pasta, pagina, alias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // UID de IMAP é por pasta: abrir(uid) só faz sentido para a pasta vigente
  // no momento do clique. Trocar de aba invalida qualquer abertura pendente.
  function limparAberto() {
    abrirId.current++;
    setAberto(null);
  }

  async function abrir(uid: number) {
    const id = ++abrirId.current;
    setRascunho(null);
    try {
      const e = await abrirEmail({ data: { pasta, uid }, headers: await cabecalhoAuth() });
      if (id !== abrirId.current) return; // outro clique ou troca de aba venceu
      setAberto(e);
      setItens((xs) => xs.map((x) => (x.uid === uid ? { ...x, lido: true } : x)));
    } catch (e) {
      if (id !== abrirId.current) return;
      toast.error((e as Error).message);
    }
  }

  function responder() {
    if (!aberto) return;
    rascunhoId.current++;
    setRascunho({
      de: aberto.alias,
      para: aberto.responderPara,
      assunto: assuntoDeResposta(aberto.assunto),
      texto: citar({ de: aberto.de, data: new Date(aberto.data), texto: aberto.texto }),
      respondendo: { pasta, uid: aberto.uid },
    });
  }

  const aba = (p: Pasta, rotulo: string) => (
    <button
      type="button"
      onClick={() => {
        setPasta(p);
        setPagina(0);
        limparAberto();
      }}
      className={`px-3 py-1.5 text-sm ${pasta === p ? "border-b-2 border-primary font-medium" : ""}`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="mr-4 text-lg font-semibold">E-mail</h1>
        {aba("entrada", "Entrada")}
        {aba("enviados", "Enviados")}
        <select
          className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
          value={alias ?? ""}
          onChange={(e) => {
            setAlias((e.target.value || undefined) as Endereco | undefined);
            setPagina(0);
          }}
        >
          <option value="">Todos</option>
          {ENDERECOS.map((e) => (
            <option key={e} value={e}>
              {ROTULO[e]}
            </option>
          ))}
        </select>
        <button type="button" onClick={carregar} aria-label="Atualizar" className="p-1.5">
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            limparAberto();
            rascunhoId.current++;
            setRascunho({ de: alias ?? PADRAO, para: "", assunto: "", texto: "" });
          }}
          className="ml-auto inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          <PenSquare className="h-4 w-4" /> Escrever
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* No celular, lista e leitura se alternam. */}
        <aside
          className={`w-full overflow-y-auto border-r border-border md:w-96 ${
            aberto || rascunho ? "hidden md:block" : ""
          }`}
        >
          <ListaEmails itens={itens} selecionado={aberto?.uid ?? null} onAbrir={abrir} />
          {total > POR_PAGINA && (
            <div className="flex justify-between p-3 text-sm">
              <button type="button" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
                ← Mais novos
              </button>
              <button
                type="button"
                disabled={(pagina + 1) * POR_PAGINA >= total}
                onClick={() => setPagina(pagina + 1)}
              >
                Mais antigos →
              </button>
            </div>
          )}
        </aside>

        <section
          className={`min-w-0 flex-1 overflow-y-auto ${aberto || rascunho ? "" : "hidden md:block"}`}
        >
          {(aberto || rascunho) && (
            <button
              type="button"
              onClick={() => {
                limparAberto();
                setRascunho(null);
              }}
              className="flex items-center gap-1 p-3 text-sm md:hidden"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          )}
          {aberto && <LeitorEmail email={aberto} pasta={pasta} onResponder={responder} />}
          {rascunho && (
            <EditorEmail
              key={rascunhoId.current}
              inicial={rascunho}
              onFechar={() => setRascunho(null)}
              onEnviado={() => {
                setRascunho(null);
                void carregar();
              }}
            />
          )}
          {!aberto && !rascunho && (
            <p className="p-6 text-sm text-muted-foreground">Escolha um e-mail na lista.</p>
          )}
        </section>
      </div>
    </div>
  );
}
