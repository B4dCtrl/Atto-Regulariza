import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, AlertCircle, Check, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Redefinir senha — Ato Regulariza" }, { name: "robots", content: "noindex" }],
  }),
  component: RedefinirSenhaPage,
});

const MINIMO = 8;

/**
 * Conclui a recuperação de senha.
 *
 * O link do e-mail traz um token de recuperação; o supabase-js o troca por uma
 * sessão automaticamente ao carregar a página. Só então `updateUser` consegue
 * gravar a senha nova.
 *
 * Esta rota não existia: o `resetPasswordForEmail` apontava para /entrar, que
 * via a sessão e mandava a pessoa direto ao painel. O resultado é que o link
 * funcionava como login e a senha jamais era trocada — a tela prometia algo
 * que não acontecia.
 */
function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [semSessao, setSemSessao] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelado = false;

    // O supabase-js processa o token da URL de forma assíncrona e dispara
    // PASSWORD_RECOVERY. Ouvimos o evento e também conferimos a sessão, porque
    // se a página recarregar depois da troca o evento já passou.
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (cancelado) return;
      if (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN") {
        setPronto(true);
        setSemSessao(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelado) return;
      if (session) setPronto(true);
      else setSemSessao(true);
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < MINIMO) {
      setErro(`A senha precisa ter ao menos ${MINIMO} caracteres.`);
      return;
    }
    if (senha !== confirmar) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(
        error.message.includes("should be different")
          ? "A senha nova precisa ser diferente da atual."
          : "Não foi possível salvar a senha. Peça um link novo e tente de novo.",
      );
      return;
    }

    setOk(true);
    // Sai da sessão de recuperação: a pessoa entra de novo com a senha nova,
    // o que confirma na prática que a troca funcionou.
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/entrar" }), 2500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface/40 px-4 py-12">
      <div className="w-full max-w-[440px] rounded-3xl bg-background p-8 ring-1 ring-border">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
          <KeyRound className="h-5 w-5" />
        </div>

        <h1 className="mt-4 font-serif text-2xl tracking-tight">Criar uma senha nova</h1>

        {ok ? (
          <div className="mt-4 flex gap-2 rounded-2xl bg-green-50 p-4 text-sm leading-relaxed text-green-800">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Senha alterada. Estamos te levando para a tela de entrada — use a senha nova para
              acessar.
            </span>
          </div>
        ) : semSessao && !pronto ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Este link expirou ou já foi usado. Peça um novo na tela de entrada, em "Esqueci minha
              senha".
            </p>
            <Link
              to="/entrar"
              className="mt-5 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm text-background hover:opacity-90"
            >
              Ir para a tela de entrada
            </Link>
          </>
        ) : !pronto ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando o link…
          </div>
        ) : (
          <form onSubmit={submeter} className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              Escolha uma senha com pelo menos {MINIMO} caracteres.
            </p>

            <div>
              <label htmlFor="senha-nova" className="mb-1.5 block text-sm font-medium">
                Senha nova
              </label>
              <div className="relative">
                <input
                  id="senha-nova"
                  type={mostrar ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-foreground/30"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-surface"
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="senha-confirmar" className="mb-1.5 block text-sm font-medium">
                Repita a senha nova
              </label>
              <input
                id="senha-confirmar"
                type={mostrar ? "text" : "password"}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/30"
              />
            </div>

            {erro && (
              <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={salvando || !senha || !confirmar}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {salvando ? "Salvando…" : "Salvar senha nova"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
