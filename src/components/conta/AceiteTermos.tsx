import { useEffect, useState } from "react";
import { FileSignature, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLAUSULAS, VERSAO_TERMOS } from "@/lib/termos";

/**
 * Aceite dos termos, com registro de quem aceitou o quê e quando.
 *
 * Mostrar o texto não basta: o que protege é a PROVA de que a pessoa aceitou, e
 * de qual versão. Por isso a versão é gravada junto — sem ela, sabe-se que
 * houve concordância, mas não com qual texto, e o texto muda.
 *
 * É bloqueante, e sem botão de recusar que apenas feche: é contrato, ou vale ou
 * não há relação. Quem não aceita, sai da conta.
 *
 * O texto integral fica dentro da caixa, não atrás de um link — link para
 * "termos" ninguém abre, e aceite sem leitura possível é aceite frágil.
 */
export function AceiteTermos({ children }: { children: React.ReactNode }) {
  const [precisa, setPrecisa] = useState<boolean | null>(null);
  const [marcado, setMarcado] = useState(false);
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
        .select("termos_versao")
        .eq("id", user.id)
        .maybeSingle();

      // Falha na consulta não tranca ninguém para fora: errar para o lado de
      // deixar trabalhar é melhor que barrar quem já aceitou.
      if (ativo) setPrecisa(!error && data?.termos_versao !== VERSAO_TERMOS);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function aceitar() {
    setSalvando(true);
    setErro(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("sem sessão");

      const { error } = await supabase
        .from("profiles")
        .update({ termos_versao: VERSAO_TERMOS, termos_aceito_em: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;

      setPrecisa(false);
    } catch {
      setErro("Não foi possível registrar seu aceite. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/entrar";
  }

  if (precisa === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface/40">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!precisa) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface/40 px-4 py-8">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10">
          <FileSignature className="h-5 w-5 text-accent" />
        </span>

        <h1 className="mt-5 font-serif text-2xl leading-tight">Termos de uso e privacidade</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Para continuar, leia e concorde com os termos abaixo. Eles explicam o que fazemos com seus
          documentos e com seus dados pessoais.
        </p>

        {/* Rolagem própria: o texto inteiro cabe aqui dentro, e o botão fica
            sempre visível no rodapé. */}
        <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl bg-surface/60 p-4 text-sm leading-relaxed">
          {CLAUSULAS.map((c) => (
            <div key={c.titulo}>
              <div className="font-medium">{c.titulo}</div>
              <p className="mt-1 text-ink-soft">{c.texto}</p>
            </div>
          ))}
          <p className="pt-2 text-[11px] text-ink-soft">Versão {VERSAO_TERMOS}</p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            Li e concordo com os Termos de Uso e o Aviso de Privacidade da Ato Regulariza.
          </span>
        </label>

        {erro && (
          <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {erro}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={aceitar}
            disabled={!marcado || salvando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Concordar e continuar
          </button>
          <button
            type="button"
            onClick={sair}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
