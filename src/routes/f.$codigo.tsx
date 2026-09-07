import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { buscarCaso, type CasoPublico } from "@/lib/api/caso.server";
import { ATENDIMENTO_PHONE } from "@/lib/brand";

/**
 * O que a pessoa vê ao tocar no link do fim da triagem.
 *
 * O bot terminou dizendo que um especialista vai atender. Esta página explica
 * o que falta — **a matrícula do imóvel** — e dá dois caminhos: criar a conta,
 * onde ela envia o documento com segurança, ou falar com a equipe.
 *
 * Os dois caminhos existem de propósito. Cadastro é fricção, e perder o caso
 * por causa dela seria pior do que atender à mão.
 *
 * É página pública: mostra só o primeiro nome e a cidade, que a própria pessoa
 * informou. Cor, motivo e relato ficam no painel, onde é lugar deles.
 */

export const Route = createFileRoute("/f/$codigo")({
  head: () => ({
    // Link pessoal: não serve para busca, e indexar exporia casos.
    meta: [
      { title: "Seu caso — Ato Regulariza" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaginaCaso,
});

function PaginaCaso() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<CasoPublico | null | "carregando">("carregando");

  useEffect(() => {
    buscarCaso({ data: { codigo } })
      .then(setCaso)
      .catch(() => setCaso(null));
  }, [codigo]);

  const nome = caso && caso !== "carregando" ? caso.primeiroNome : "";
  const ola = nome ? `${nome}, ` : "";

  const whats = `https://wa.me/${ATENDIMENTO_PHONE}?text=${encodeURIComponent(
    `Olá! Terminei a triagem pelo assistente. Meu código é ${codigo}.`,
  )}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface/40 px-4 py-10">
      <div className="w-full max-w-md">
        <img src="/ato-lockup.png" alt="Ato Regulariza" className="mx-auto mb-8 h-9 w-auto" />

        {caso === "carregando" && (
          <div className="rounded-3xl bg-background p-6 ring-1 ring-border">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-surface" />
          </div>
        )}

        {/* Código que não existe, ou expirado. Não dizemos qual dos dois: a
            página não serve de teste para descobrir códigos válidos. */}
        {caso === null && (
          <div className="rounded-3xl bg-background p-6 text-center ring-1 ring-border">
            <h1 className="font-serif text-xl">Não encontramos este link</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Ele pode ter expirado. Fale com a gente que retomamos seu caso de onde parou.
            </p>
            <a
              href={whats}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com a equipe
            </a>
          </div>
        )}

        {caso && caso !== "carregando" && (
          <div className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
            <h1 className="font-serif text-2xl leading-tight">
              {ola}falta um documento para começarmos
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              É a <strong className="font-medium text-foreground">matrícula atualizada</strong> do
              imóvel{caso.cidade ? `, em ${caso.cidade}` : ""}. É por ela que descobrimos o que
              consta no cartório hoje — e sem isso qualquer orçamento seria chute.
            </p>

            <div className="mt-5 space-y-2.5 rounded-2xl bg-surface/60 p-4 text-sm">
              <div className="flex gap-2.5">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                <span className="leading-relaxed text-ink-soft">
                  Não tem em mãos? Pede no cartório de registro de imóveis da cidade — a gente te
                  orienta como.
                </span>
              </div>
              <div className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                <span className="leading-relaxed text-ink-soft">
                  O envio é pela sua conta, com acesso só seu e da equipe do seu caso.
                </span>
              </div>
            </div>

            {caso.jaCadastrado ? (
              <Link
                to="/entrar"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm text-background transition-opacity hover:opacity-90"
              >
                Entrar na minha conta
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigate({ to: "/cadastrar", search: { caso: codigo } as never })}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm text-background transition-opacity hover:opacity-90"
              >
                Criar minha conta e enviar
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <a
              href={whats}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-ink-soft transition-colors hover:bg-surface"
            >
              <MessageCircle className="h-4 w-4" />
              Prefiro falar com alguém
            </a>

            <p className="mt-5 text-center text-[11px] text-ink-soft">
              Caso <span className="font-mono">{codigo}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
