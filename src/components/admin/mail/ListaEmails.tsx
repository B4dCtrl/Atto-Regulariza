import { Paperclip } from "lucide-react";
import type { ResumoEmail } from "@/lib/api/mail-imap.server";
import { ROTULO, type Pessoal } from "@/lib/mail/enderecos";

export function ListaEmails({
  itens,
  carregando = false,
  selecionado,
  onAbrir,
}: {
  itens: ResumoEmail[];
  carregando?: boolean;
  selecionado: number | null;
  onAbrir: (uid: number) => void;
}) {
  if (itens.length === 0) {
    // Lista vazia enquanto a visão nova carrega não é "caixa vazia".
    if (carregando) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
    return <p className="p-6 text-sm text-muted-foreground">Nenhum e-mail aqui.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {itens.map((m) => (
        <li key={m.uid}>
          <button
            type="button"
            onClick={() => onAbrir(m.uid)}
            className={`w-full px-4 py-3 text-left hover:bg-surface ${
              selecionado === m.uid ? "bg-surface" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-sm ${m.lido ? "" : "font-semibold"}`}>{m.de}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(m.data).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`truncate text-sm ${m.lido ? "text-muted-foreground" : ""}`}>
                {m.assunto}
              </span>
              {m.temAnexo && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">para {ROTULO[m.alias]}</span>
              {m.atribuido && <EtiquetaAtribuido pessoa={m.atribuido} />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "com Taís": a quem o e-mail foi atribuído. Todos os admins veem. */
export function EtiquetaAtribuido({ pessoa }: { pessoa: Pessoal }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      com {ROTULO[pessoa]}
    </span>
  );
}
