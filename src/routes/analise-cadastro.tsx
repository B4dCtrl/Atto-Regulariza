import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, ShieldCheck, XCircle, LogOut, Mail } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/analise-cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro em análise — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: AnaliseCadastroPage,
});

function AnaliseCadastroPage() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pendente" | "aprovado" | "recusado" | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("name, role, approval_status, approval_note")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.name ?? "");
        setNota(data.approval_note ?? null);
        setStatus(data.approval_status as typeof status);
        // Já aprovado: manda direto para o painel.
        if (data.approval_status === "aprovado" && data.role === "profissional") {
          navigate({ to: "/painel-profissional" });
        }
      });
  }, [userId, navigate]);

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  };

  const recusado = status === "recusado";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-lg rounded-3xl bg-background p-8 ring-1 ring-border sm:p-10">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl ${
            recusado ? "bg-red-50 text-red-600" : "bg-accent/15 text-accent"
          }`}
        >
          {recusado ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>

        <h1 className="mt-5 font-serif text-3xl leading-tight tracking-tight">
          {recusado ? "Cadastro não aprovado" : "Seu cadastro está em análise"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {recusado ? (
            <>
              Infelizmente não conseguimos aprovar seu cadastro como profissional
              {nome ? `, ${nome.split(" ")[0]}` : ""}. Se acredita que houve engano, fale com a
              nossa equipe — revisamos caso a caso.
            </>
          ) : (
            <>
              Obrigado pelo cadastro{nome ? `, ${nome.split(" ")[0]}` : ""}. Toda conta de
              profissional passa por{" "}
              <strong className="text-foreground">conferência manual da nossa equipe</strong> antes
              de ser liberada — é assim que garantimos que só profissionais habilitados tenham
              acesso aos processos e aos dados dos clientes.
            </>
          )}
        </p>

        {nota && (
          <div className="mt-5 rounded-2xl bg-surface/60 p-4">
            <div className="text-[10px] uppercase tracking-widest text-ink-soft">
              Observação da equipe
            </div>
            <p className="mt-1.5 text-sm leading-relaxed">{nota}</p>
          </div>
        )}

        {!recusado && (
          <div className="mt-6 space-y-3">
            {[
              {
                icon: ShieldCheck,
                titulo: "O que estamos conferindo",
                texto: "Seus dados profissionais e o registro informado no cadastro.",
              },
              {
                icon: Clock,
                titulo: "Quanto tempo leva",
                texto: "Em geral até 2 dias úteis. Você não precisa fazer nada nesse período.",
              },
              {
                icon: Mail,
                titulo: "Como você fica sabendo",
                texto:
                  "Avisamos no e-mail cadastrado assim que a análise terminar. É só entrar de novo aqui para acessar o painel.",
              },
            ].map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="flex gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                <div>
                  <div className="text-sm font-medium">{titulo}</div>
                  <div className="mt-0.5 text-sm leading-relaxed text-ink-soft">{texto}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* WhatsApp, não e-mail: quem está esperando liberação quer resposta
              agora, e a mensagem já vai escrita — a pessoa não precisa explicar
              de novo por que está falando. */}
          <a
            href={WHATSAPP.cadastroEmAnalise}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm text-background transition-opacity hover:opacity-90"
          >
            Falar com a equipe
          </a>
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
