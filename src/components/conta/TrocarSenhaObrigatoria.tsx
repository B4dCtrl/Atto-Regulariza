import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Trava o painel enquanto a senha provisória estiver valendo.
 *
 * Contas criadas pelo admin nascem com senha gerada, repassada por fora do
 * sistema — WhatsApp, telefone, e-mail. Até ser trocada, ela é conhecida por
 * mais de uma pessoa, e quem tem acesso ao canal por onde ela passou tem acesso
 * à conta.
 *
 * É um bloqueio, não um aviso: aviso que dá para fechar é aviso que fica aberto
 * para sempre. O componente devolve `children` só depois da troca.
 *
 * Falha ao consultar não tranca ninguém para fora: se a consulta ao perfil não
 * responde, o painel abre normalmente. Errar para o lado de deixar trabalhar é
 * melhor que errar para o lado de travar quem não tem culpa.
 */
export function TrocarSenhaObrigatoria({ children }: { children: React.ReactNode }) {
  const [precisa, setPrecisa] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (ativo) setPrecisa(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("senha_provisoria")
        .eq("id", user.id)
        .maybeSingle();
      if (ativo) setPrecisa(!error && data?.senha_provisoria === true);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function trocar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    try {
      const { error: erroSenha } = await supabase.auth.updateUser({ password: senha });
      if (erroSenha) {
        // O Supabase recusa senha igual à anterior, entre outras — a mensagem
        // dele é em inglês, então traduzimos o caso que acontece de verdade.
        setErro(
          /same/i.test(erroSenha.message)
            ? "Escolha uma senha diferente da provisória."
            : "Não foi possível trocar a senha. Tente de novo.",
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // O gatilho no banco confere que a senha mudou mesmo antes de aceitar
        // esta baixa — desmarcar sem trocar devolveria o acesso sem trocar nada.
        await supabase.from("profiles").update({ senha_provisoria: false }).eq("id", user.id);
      }
      setPrecisa(false);
    } finally {
      setSalvando(false);
    }
  }

  // Enquanto não sabemos, não piscamos o painel nem o bloqueio.
  if (precisa === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface/40">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!precisa) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-background p-8 ring-1 ring-border">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10">
          <ShieldAlert className="h-5 w-5 text-accent" />
        </span>

        <h1 className="mt-5 font-serif text-2xl leading-tight">Crie sua senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Sua conta foi criada pela equipe com uma senha provisória, que chegou até você por fora do
          sistema. Escolha uma senha só sua antes de continuar.
        </p>

        <form onSubmit={trocar} className="mt-6 space-y-3">
          <div>
            <label htmlFor="senha-nova" className="mb-1.5 block text-sm font-medium">
              Nova senha
            </label>
            <input
              id="senha-nova"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/30"
            />
            <p className="mt-1 text-[11px] text-ink-soft">Ao menos 8 caracteres.</p>
          </div>

          <div>
            <label htmlFor="senha-confirma" className="mb-1.5 block text-sm font-medium">
              Repita a nova senha
            </label>
            <input
              id="senha-confirma"
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/30"
            />
          </div>

          {erro && (
            <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Salvar e entrar
          </button>
        </form>
      </div>
    </div>
  );
}
