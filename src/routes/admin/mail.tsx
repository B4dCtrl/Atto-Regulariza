import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, PenSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listarEmails,
  abrirEmail,
  abrirEmailComImagens,
  atribuirEmail,
  minhaCaixa,
} from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import type { ResumoEmail, EmailAberto } from "@/lib/api/mail-imap.server";
import { ROTULO, PADRAO, ehPessoal, type Pessoal } from "@/lib/mail/enderecos";
import { VISOES, ROTULO_VISAO, type Visao } from "@/lib/mail/visoes";
import { POR_PAGINA, type Pasta } from "@/lib/mail/validacao";
import { assuntoDeResposta, citar } from "@/lib/mail/resposta";
import { ListaEmails } from "@/components/admin/mail/ListaEmails";
import { LeitorEmail, type EstadoImagens } from "@/components/admin/mail/LeitorEmail";
import { EditorEmail, type Rascunho } from "@/components/admin/mail/EditorEmail";

export const Route = createFileRoute("/admin/mail")({
  head: () => ({
    meta: [{ title: "E-mail — Ato Regulariza" }, { name: "robots", content: "noindex" }],
  }),
  component: MailPage,
});

function MailPage() {
  const [pasta, setPasta] = useState<Pasta>("entrada");
  // Nulo até o servidor dizer de qual caixa esta pessoa é (`minhaCaixa`): a
  // lista só carrega depois, para não piscar "Todos" antes da caixa dela.
  const [visao, setVisao] = useState<Visao | null>(null);
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<ResumoEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<EmailAberto | null>(null);
  const [imagens, setImagens] = useState<EstadoImagens>("bloqueadas");
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [atribuindo, setAtribuindo] = useState(false);
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
  // Qual lista está na tela. Trocar de visão/aba/página esvazia a lista na
  // hora: a da visão anterior não fica à mostra sob o nome da nova enquanto o
  // IMAP responde. "Atualizar" (mesma chave) mantém a lista visível.
  const chaveNaTela = useRef("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await minhaCaixa({ headers: await cabecalhoAuth() });
        if (vivo) setVisao((atual) => atual ?? r.visao);
      } catch {
        // Sem resposta, abre em "Todos" — todo admin pode ver a caixa inteira.
        if (vivo) setVisao((atual) => atual ?? "todos");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    if (!visao) return;
    const id = ++cargaId.current;
    const chave = `${pasta}|${visao}|${pagina}`;
    if (chave !== chaveNaTela.current) {
      chaveNaTela.current = chave;
      setItens([]);
      setTotal(0);
    }
    setCarregando(true);
    try {
      const r = await listarEmails({
        data: { pasta, pagina, visao },
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
  }, [pasta, pagina, visao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // `atribuir` chama isto depois de um `await`, quando pode já existir um
  // `carregar` mais novo (pasta/visão/página mudou enquanto o salvamento
  // estava em voo). Uma ref sempre atualizada evita que a closure antiga
  // recarregue a lista velha por cima da visão nova.
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  // UID de IMAP é por pasta: abrir(uid) só faz sentido para a pasta vigente
  // no momento do clique. Trocar de aba invalida qualquer abertura pendente.
  function limparAberto() {
    abrirId.current++;
    setAberto(null);
    setImagens("bloqueadas");
  }

  async function abrir(uid: number) {
    const id = ++abrirId.current;
    setRascunho(null);
    try {
      const e = await abrirEmail({ data: { pasta, uid }, headers: await cabecalhoAuth() });
      if (id !== abrirId.current) return; // outro clique ou troca de aba venceu
      setAberto(e);
      // Só aqui: se a abertura falhar, o e-mail anterior continua na tela e
      // mantém o estado das imagens dele.
      setImagens("bloqueadas");
      setItens((xs) => xs.map((x) => (x.uid === uid ? { ...x, lido: true } : x)));
    } catch (e) {
      if (id !== abrirId.current) return;
      // Um "Mostrar imagens" do anterior que estava em voo teve a resposta
      // descartada (este clique mudou `abrirId`): destrava o botão.
      setImagens((s) => (s === "carregando" ? "bloqueadas" : s));
      toast.error((e as Error).message);
    }
  }

  // Mesma disciplina de `abrir`: não incrementa `abrirId`, só confere que
  // nenhuma abertura/troca de aba aconteceu enquanto as imagens baixavam —
  // senão o HTML de um e-mail apareceria sob o cabeçalho de outro.
  async function mostrarImagens() {
    if (!aberto || imagens === "carregando") return;
    const id = abrirId.current;
    const uid = aberto.uid;
    setImagens("carregando");
    try {
      const e = await abrirEmailComImagens({
        data: { pasta, uid },
        headers: await cabecalhoAuth(),
      });
      if (id !== abrirId.current) return;
      // Mantém o `atribuido` do estado atual: se um "Atribuir a…" terminou
      // enquanto as imagens carregavam, `e` veio com a etiqueta de antes e
      // não pode apagar a mais nova.
      setAberto((atual) =>
        atual && atual.uid === uid ? { ...e, atribuido: atual.atribuido } : atual,
      );
      setImagens("mostradas");
      if (e.imagensExternas > 0) {
        toast.info(
          e.imagensExternas === 1
            ? "1 imagem não pôde ser carregada."
            : `${e.imagensExternas} imagens não puderam ser carregadas.`,
        );
      }
    } catch (e) {
      if (id !== abrirId.current) return;
      setImagens("bloqueadas");
      toast.error((e as Error).message);
    }
  }

  // "Atribuir a…". Mesma disciplina de `mostrarImagens`: só aplica a resposta
  // se o e-mail aberto ainda é o mesmo. Recarrega a lista porque a atribuição
  // pode pôr ou tirar o e-mail da visão atual (e muda a etiqueta).
  async function atribuir(responsavel: Pessoal | null) {
    if (!aberto || atribuindo) return;
    const id = abrirId.current;
    const uid = aberto.uid;
    setAtribuindo(true);
    try {
      const r = await atribuirEmail({
        data: { pasta, uid, responsavel },
        headers: await cabecalhoAuth(),
      });
      if (id !== abrirId.current) return;
      setAberto((atual) =>
        atual && atual.uid === uid ? { ...atual, atribuido: r.atribuido } : atual,
      );
      toast.success(r.atribuido ? `Atribuído a ${ROTULO[r.atribuido]}.` : "Atribuição removida.");
      void carregarRef.current();
    } catch (e) {
      if (id !== abrirId.current) return;
      toast.error((e as Error).message);
    } finally {
      setAtribuindo(false);
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
          aria-label="Caixa"
          className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
          value={visao ?? ""}
          disabled={!visao}
          onChange={(e) => {
            setVisao(e.target.value as Visao);
            setPagina(0);
          }}
        >
          {!visao && <option value="">Carregando…</option>}
          {VISOES.map((v) => (
            <option key={v} value={v}>
              {ROTULO_VISAO[v]}
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
            // Na caixa de uma pessoa, escreve como ela; no Geral/Todos, contato@.
            setRascunho({
              de: visao && ehPessoal(visao) ? visao : PADRAO,
              para: "",
              assunto: "",
              texto: "",
            });
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
          <ListaEmails
            itens={itens}
            // `!visao` cobre o instante entre montar e `minhaCaixa` responder:
            // sem isso, a lista mostra "Nenhum e-mail aqui." antes mesmo de
            // `carregar` começar (que só roda depois que `visao` existe).
            carregando={carregando || !visao}
            selecionado={aberto?.uid ?? null}
            onAbrir={abrir}
          />
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
          {aberto && (
            <LeitorEmail
              email={aberto}
              pasta={pasta}
              onResponder={responder}
              imagens={imagens}
              onMostrarImagens={mostrarImagens}
              atribuindo={atribuindo}
              onAtribuir={atribuir}
            />
          )}
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
