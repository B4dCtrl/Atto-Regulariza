import { useState } from "react";
import { toast } from "sonner";
import { ENDERECOS, ROTULO, type Endereco } from "@/lib/mail/enderecos";
import { schemaEnviar } from "@/lib/mail/validacao";
import { enviarEmailDaCaixa } from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import type { Pasta } from "@/lib/mail/validacao";

export type Rascunho = {
  de: Endereco;
  para: string;
  assunto: string;
  texto: string;
  respondendo?: { pasta: Pasta; uid: number };
};

/** Escrever ou responder. Texto simples: formatação e anexo ficam para depois. */
export function EditorEmail({
  inicial,
  onFechar,
  onEnviado,
}: {
  inicial: Rascunho;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [r, setR] = useState(inicial);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const entrada = {
      de: r.de,
      para: r.para.split(/[,;\s]+/).filter(Boolean),
      assunto: r.assunto,
      texto: r.texto,
      respondendo: r.respondendo,
    };
    // Mesma validação do servidor, para avisar antes de gastar a ida.
    const v = schemaEnviar.safeParse(entrada);
    if (!v.success) {
      toast.error("Confira destinatário, assunto e mensagem.");
      return;
    }
    setEnviando(true);
    try {
      await enviarEmailDaCaixa({ data: v.data, headers: await cabecalhoAuth() });
      toast.success("E-mail enviado.");
      onEnviado();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const campo = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-2 border-t border-border p-4">
      <select
        className={campo}
        value={r.de}
        onChange={(e) => setR({ ...r, de: e.target.value as Endereco })}
      >
        {ENDERECOS.map((e) => (
          <option key={e} value={e}>
            {ROTULO[e]} — {e}
          </option>
        ))}
      </select>
      <input
        className={campo}
        placeholder="Para (separe vários por vírgula)"
        value={r.para}
        onChange={(e) => setR({ ...r, para: e.target.value })}
      />
      <input
        className={campo}
        placeholder="Assunto"
        maxLength={200}
        value={r.assunto}
        onChange={(e) => setR({ ...r, assunto: e.target.value })}
      />
      <textarea
        className={`${campo} min-h-[200px]`}
        maxLength={20_000}
        value={r.texto}
        onChange={(e) => setR({ ...r, texto: e.target.value })}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFechar} className="px-3 py-1.5 text-sm">
          Descartar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={enviar}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
