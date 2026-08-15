import { useId, useRef, useState } from "react";
import { Upload, Loader2, AlertCircle, Check } from "lucide-react";
import { enviarDocumento } from "@/lib/api/documentos";
import { kindsPara, type DocumentKind, type DocumentOrigem } from "@/lib/document-kinds";

/**
 * Envio com tipo obrigatório.
 *
 * O tipo é o que permite amarrar o arquivo ao documento certo — enviando
 * "matrícula" duas vezes, a segunda vira versão 2 da primeira em vez de um
 * registro solto. Por isso o botão fica travado até haver escolha.
 *
 * O `accept` do input é conveniência para quem age de boa-fé. A validação que
 * vale (tipo, assinatura real do conteúdo e tamanho) está na edge function,
 * onde o navegador não alcança.
 */
export function UploadDocumento({
  propertyId,
  origem,
  onEnviado,
}: {
  propertyId: string;
  origem: DocumentOrigem;
  onEnviado: () => void;
}) {
  // Só o CLIENTE escolhe o tipo. Para ele o seletor tem função concreta: é o
  // que faz o reenvio de "Matrícula" virar versão 2 em vez de um registro
  // solto. O profissional envia peças distintas a cada vez (ART, laudo,
  // projeto), que não se substituem entre si — exigir classificação dele seria
  // burocracia sem retorno.
  const exigeTipo = origem === "cliente";

  const [kind, setKind] = useState<DocumentKind | "">(exigeTipo ? "" : "outro");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  const opcoes = kindsPara(origem);

  function limparInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  async function aoEscolherArquivo(arquivo: File | undefined) {
    // A trava por `enviando` cobre o caso de escolher outro arquivo enquanto o
    // anterior sobe; o botão desabilitado cobre o clique duplo.
    if (!arquivo || !kind || enviando) return;

    setEnviando(true);
    setErro(null);
    setConfirmado(null);

    try {
      await enviarDocumento({ arquivo, propertyId, kind: kind as DocumentKind, origem });
      // Só aqui o envio é dado como certo: a confirmação vem do servidor, que
      // já gravou o arquivo e a versão. Foi a mentira do "Enviado" sem arquivo
      // que originou este trabalho — não a repetimos na interface.
      setConfirmado(arquivo.name);
      if (exigeTipo) setKind("");
      onEnviado();
    } catch (e) {
      // A edge function devolve mensagem já escrita para o usuário final
      // (limite de tamanho, tipo recusado, conteúdo que não confere).
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      // Limpar sempre: sem isso, escolher o MESMO arquivo depois de uma falha
      // não dispara onChange e o usuário fica sem entender por que nada acontece.
      limparInput();
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface/50 p-4">
      {exigeTipo ? (
        <>
          <label htmlFor={selectId} className="block text-sm font-medium">
            Qual documento você está enviando?
          </label>
          <select
            id={selectId}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as DocumentKind);
              setErro(null);
              setConfirmado(null);
            }}
            disabled={enviando}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30 disabled:opacity-50"
          >
            <option value="">Selecione…</option>
            {opcoes.map((o) => (
              <option key={o.kind} value={o.kind}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      ) : (
        <p className="text-sm font-medium">Enviar documento</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        disabled={(exigeTipo && !kind) || enviando}
        onChange={(e) => aoEscolherArquivo(e.target.files?.[0])}
        className="hidden"
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={(exigeTipo && !kind) || enviando}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {enviando ? "Enviando…" : "Escolher arquivo"}
      </button>

      <p className="mt-2 text-xs text-ink-soft">
        {enviando ? "Não feche esta página até o envio terminar." : "PDF, JPEG ou PNG · até 25 MB"}
      </p>

      {/* aria-live: quem usa leitor de tela precisa saber do resultado sem
          precisar navegar até aqui. */}
      <div aria-live="polite">
        {confirmado && !erro && (
          <div className="mt-3 flex gap-2 rounded-xl bg-green-50 p-3 text-xs leading-relaxed text-green-800">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>{confirmado}</strong> foi enviado e guardado.
            </span>
          </div>
        )}

        {erro && (
          <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </div>
    </div>
  );
}
