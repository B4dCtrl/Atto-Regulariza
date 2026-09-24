import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Mail, UserRound } from "lucide-react";
import { resumoPessoal, type ResumoPessoal } from "@/lib/api/resumo-pessoal.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";

/**
 * "O que é seu": o que está com o admin logado — e-mails não lidos da caixa
 * dele e processos atribuídos a ele.
 *
 * Carrega sozinho, em paralelo ao "O que exige você agora": a caixa de e-mail
 * pode demorar, e o resumo da operação não deve esperar por ela. Sem IA — a
 * frase é montada por regra no servidor.
 */
export function OQueESeu() {
  const [resumo, setResumo] = useState<ResumoPessoal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await resumoPessoal({ headers: await cabecalhoAuth() });
        if (vivo) setResumo(r);
      } catch {
        // Cartão pessoal é conveniência: falhou, some com um aviso curto e o
        // resto do painel segue normal.
        if (vivo) setErro(true);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
          <UserRound className="h-3.5 w-3.5" />
        </span>
        <div className="text-sm font-medium leading-none">O que é seu</div>
      </div>

      {carregando ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
        </div>
      ) : erro || !resumo ? (
        <div className="mt-4 flex gap-2 rounded-xl bg-surface p-3 text-xs text-ink-soft">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Não foi possível carregar o seu resumo agora.</span>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">{resumo.saudacao}</p>

          {/* Link, não <a>: com <a> a página recarrega, o beforeLoad roda no
              servidor sem a sessão (que vive no localStorage) e desloga. */}
          <Link
            to="/admin/mail"
            className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
          >
            <Mail className="h-4 w-4 shrink-0 text-ink-soft" />
            <span className="min-w-0 flex-1 text-sm">
              {resumo.naoLidos === null
                ? "E-mails: indisponível no momento"
                : resumo.naoLidos === 1
                  ? "1 e-mail não lido"
                  : `${resumo.naoLidos} e-mails não lidos`}
            </span>
            <span className="text-[11px] text-ink-soft">
              {resumo.caixa ? `caixa de ${resumo.caixa}` : "caixa inteira"}
            </span>
          </Link>

          {resumo.processos.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">
                Seus processos
              </div>
              <ul className="mt-2 space-y-1">
                {resumo.processos.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/admin/projeto/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{p.nome}</span>
                      <span className="shrink-0 text-[11px] text-ink-soft">etapa {p.etapa}</span>
                      <span
                        className={`shrink-0 text-[11px] ${p.parado ? "text-accent" : "text-ink-soft"}`}
                      >
                        {p.parado
                          ? `parado há ${p.diasParado} ${p.diasParado === 1 ? "dia" : "dias"}`
                          : p.diasParado === 0
                            ? "há menos de 1 dia"
                            : `há ${p.diasParado} ${p.diasParado === 1 ? "dia" : "dias"}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
