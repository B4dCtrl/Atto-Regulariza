import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Login com Google pelo botão oficial (Google Identity Services).
 *
 * Por que não `signInWithOAuth`: nele quem pede o login ao Google é o servidor
 * do Supabase, e a tela do Google dizia "Prosseguir para
 * fmscewpxmqnbodzstiqa.supabase.co" — endereço estranho para o cliente, pouca
 * confiança. Aqui quem pede é o próprio site (atoregulariza.com.br): o Google
 * devolve um token de identidade, e o Supabase o troca por uma sessão
 * (`signInWithIdToken`). A conta e o resto do fluxo continuam iguais.
 *
 * Exige no Google Cloud as "Origens JavaScript autorizadas" do site. Se o
 * script do Google não carregar (bloqueador, rede), mostra o botão antigo,
 * pelo caminho de antes: ninguém fica sem entrar.
 */

/** Público por natureza (vai no HTML de qualquer site com login do Google). */
const GOOGLE_CLIENT_ID = "79725332135-0caupkgfdb18cpscnn3q6497mbdoqsfs.apps.googleusercontent.com";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type RespostaGoogle = { credential?: string };

type GoogleId = {
  initialize: (opts: {
    client_id: string;
    callback: (r: RespostaGoogle) => void;
    nonce: string;
    ux_mode?: "popup" | "redirect";
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let carregamento: Promise<GoogleId> | null = null;

/** Carrega o script do Google uma vez só, mesmo com vários botões na página. */
function carregarGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (carregamento) return carregamento;
  carregamento = new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("gsi"));
    s.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(s);
  }).catch((e) => {
    carregamento = null;
    throw e;
  });
  return carregamento;
}

/**
 * O nonce amarra o token a este clique: o Google recebe o hash, o Supabase
 * recebe o original e confere. Sem ele, um token vazado poderia ser reusado.
 */
async function novoNonce(): Promise<{ bruto: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const bruto = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bruto));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { bruto, hash };
}

export function BotaoGoogle({
  onEntrou,
  onErro,
  caminhoAntigo,
  desabilitado,
}: {
  /** Sessão criada: quem chama decide para onde levar. */
  onEntrou: (userId: string) => void;
  onErro: (mensagem: string) => void;
  /** Login pelo caminho antigo, se o botão do Google não carregar. */
  caminhoAntigo: () => void;
  desabilitado?: boolean;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);
  // As funções de quem chama mudam a cada render; o botão do Google é
  // montado uma vez só, então lê sempre a versão atual por aqui.
  const callbacks = useRef({ onEntrou, onErro });
  callbacks.current = { onEntrou, onErro };

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [gid, nonce] = await Promise.all([carregarGoogle(), novoNonce()]);
        if (!ativo || !alvo.current) return;

        gid.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hash,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            if (!credential) {
              callbacks.current.onErro("O Google não confirmou o login. Tente de novo.");
              return;
            }
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce: nonce.bruto,
            });
            if (error || !data.user) {
              callbacks.current.onErro("Não foi possível entrar com o Google. Tente de novo.");
              return;
            }
            callbacks.current.onEntrou(data.user.id);
          },
        });

        gid.renderButton(alvo.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          locale: "pt-BR",
          // O Google aceita de 200 a 400 px.
          width: Math.max(200, Math.min(400, alvo.current.offsetWidth || 320)),
        });
      } catch {
        if (ativo) setFalhou(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (falhou) {
    return (
      <button
        type="button"
        onClick={caminhoAntigo}
        disabled={desabilitado}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-border
                   bg-surface-elevated py-3 text-sm transition-colors hover:border-foreground/30
                   disabled:opacity-60"
      >
        Entrar com Google
      </button>
    );
  }

  return (
    <div
      className={`flex min-h-[44px] w-full justify-center ${desabilitado ? "pointer-events-none opacity-60" : ""}`}
    >
      <div ref={alvo} className="w-full max-w-[400px]" />
    </div>
  );
}
