import { Download, ImageOff, Reply } from "lucide-react";
import { toast } from "sonner";
import type { EmailAberto } from "@/lib/api/mail-imap.server";
import type { Pasta } from "@/lib/mail/validacao";
import { baixarAnexoEmail } from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import { PESSOAIS, ROTULO, type Pessoal } from "@/lib/mail/enderecos";
import { EtiquetaAtribuido } from "./ListaEmails";

// Mesmo teto de `LIMITE_ANEXO` no servidor: mostrar o botão de baixar para
// um anexo que o servidor vai recusar só gastaria o clique do admin.
const LIMITE_ANEXO = 3 * 1024 * 1024;

/**
 * O e-mail aberto.
 *
 * O corpo vai num iframe sem scripts e sem mesma origem: mesmo que algo
 * escape da limpeza do servidor, não roda e não alcança a sessão do admin.
 */
export type EstadoImagens = "bloqueadas" | "carregando" | "mostradas";

export function LeitorEmail({
  email,
  pasta,
  onResponder,
  imagens,
  onMostrarImagens,
  atribuindo,
  onAtribuir,
}: {
  email: EmailAberto;
  pasta: Pasta;
  onResponder: () => void;
  imagens: EstadoImagens;
  onMostrarImagens: () => void;
  atribuindo: boolean;
  onAtribuir: (responsavel: Pessoal | null) => void;
}) {
  async function baixar(indice: number) {
    try {
      const a = await baixarAnexoEmail({
        data: { pasta, uid: email.uid, indice },
        headers: await cabecalhoAuth(),
      });
      const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
      // octet-stream: o navegador baixa, nunca abre o anexo na página.
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{email.assunto}</h2>
          {/* Organização, não permissão: qualquer admin atribui, troca ou tira,
              e o servidor lê o Message-ID da própria mensagem. */}
          <div className="flex items-center gap-2">
            {email.atribuido && <EtiquetaAtribuido pessoa={email.atribuido} />}
            <select
              aria-label="Atribuir a"
              className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-60"
              value={email.atribuido ?? ""}
              disabled={atribuindo}
              onChange={(e) => onAtribuir((e.target.value || null) as Pessoal | null)}
            >
              <option value="">{email.atribuido ? "Tirar atribuição" : "Atribuir a…"}</option>
              {PESSOAIS.map((p) => (
                <option key={p} value={p}>
                  {ROTULO[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm">{email.de}</p>
        <p className="text-xs text-muted-foreground">
          para {email.para.join(", ")} · {new Date(email.data).toLocaleString("pt-BR")}
        </p>
        {email.anexos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {email.anexos.map((a) =>
              a.tamanho > LIMITE_ANEXO ? (
                <span
                  key={a.indice}
                  title="Anexo grande demais para baixar pelo painel"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground opacity-60"
                >
                  {a.nome} ({Math.ceil(a.tamanho / 1024)} KB) — grande demais, abrir no webmail
                </span>
              ) : (
                <button
                  key={a.indice}
                  type="button"
                  onClick={() => baixar(a.indice)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                >
                  <Download className="h-3 w-3" /> {a.nome} ({Math.ceil(a.tamanho / 1024)} KB)
                </button>
              ),
            )}
          </div>
        )}
        {pasta === "entrada" && (
          <button
            type="button"
            onClick={onResponder}
            className="mt-3 inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            <Reply className="h-4 w-4" /> Responder
          </button>
        )}
      </header>
      {/* Opt-in por e-mail: quem baixa é o servidor, então o remetente não
          vê o navegador do admin nem sabe quando ele leu. */}
      {email.imagensExternas > 0 && imagens !== "mostradas" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
          <ImageOff className="h-3.5 w-3.5 shrink-0" />
          <span>Imagens externas bloqueadas para proteger sua privacidade.</span>
          <button
            type="button"
            onClick={onMostrarImagens}
            disabled={imagens === "carregando"}
            className="font-medium text-foreground underline underline-offset-2 disabled:no-underline disabled:opacity-60"
          >
            {imagens === "carregando" ? "Carregando imagens…" : "Mostrar imagens"}
          </button>
        </div>
      )}
      <iframe
        title="Conteúdo do e-mail"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={email.html}
        className="min-h-[400px] w-full flex-1 bg-white"
      />
    </article>
  );
}
