import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveLandingPath } from "@/lib/auth-routing";

/**
 * Diz quem já está conectado, em vez de entrar sozinho.
 *
 * A rota `/entrar` redirecionava direto ao painel quando encontrava qualquer
 * sessão. Parecia conveniência, e era: até alguém confirmar um cadastro novo,
 * clicar em "Entrar" e cair na conta de outra pessoa — a que tinha usado aquele
 * navegador por último. Num produto que trata CPF e matrícula, entrar em conta
 * alheia sem aviso não é conveniência.
 *
 * Agora a escolha é explícita: continuar como quem está, ou sair e entrar como
 * outro. Um clique a mais para quem volta ao próprio computador, e uma
 * armadilha a menos para quem usa computador compartilhado.
 */
export function SessaoEmAberto({ aoTrocar }: { aoTrocar: () => void }) {
  const [nome, setNome] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !ativo) return;

      setEmail(session.user.email ?? null);
      const { data: perfil } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!ativo) return;
      setNome(perfil?.name ?? null);
      setDestino(await resolveLandingPath(session.user.id));
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function sair() {
    setSaindo(true);
    await supabase.auth.signOut();
    // Avisa a tela de login para ela deixar de mostrar este bloco e
    // apresentar o formulário.
    aoTrocar();
    setSaindo(false);
  }

  if (!email) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium">Você já está conectado</div>
          <div className="truncate text-xs text-ink-soft">
            {nome ? `${nome} · ${email}` : email}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={destino ?? "/dashboard"}
          className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-center text-sm text-background transition-opacity hover:opacity-90"
        >
          Continuar
        </a>
        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Entrar em outra conta
        </button>
      </div>
    </div>
  );
}
