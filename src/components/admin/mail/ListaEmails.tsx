import { Paperclip } from "lucide-react";
import type { ResumoEmail } from "@/lib/api/mail-imap.server";
import { ROTULO } from "@/lib/mail/enderecos";

export function ListaEmails({
  itens,
  selecionado,
  onAbrir,
}: {
  itens: ResumoEmail[];
  selecionado: number | null;
  onAbrir: (uid: number) => void;
}) {
  if (itens.length === 0) {
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
            <span className="text-[11px] text-muted-foreground">para {ROTULO[m.alias]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
