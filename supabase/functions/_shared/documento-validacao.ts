/**
 * Validação de arquivos enviados — fonte única.
 *
 * Roda dentro da edge function (Deno) e é testada por Vitest (Node). Por isso
 * só usa APIs padrão da linguagem: nada de Deno.*, nada de Node.*.
 *
 * A validação de verdade acontece aqui, no servidor. O que o navegador checa
 * serve ao usuário de boa-fé; quem controla o cliente controla o que o cliente
 * declara, então o Content-Type recebido é declaração, não fato.
 */

export const TAMANHO_MAXIMO_BYTES = 26_214_400; // 25 MB

export const MIMES_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"] as const;
export type MimePermitido = (typeof MIMES_PERMITIDOS)[number];

export type CodigoErro = "tamanho" | "tipo" | "assinatura" | "nome";

/**
 * Bytes iniciais que identificam cada formato. Lista de permissão: o que não
 * está aqui é recusado, inclusive formato que ainda não existe.
 *
 * SVG e HTML ficam de fora por decisão explícita — SVG é XML que aceita
 * <script>, e seria servido como imagem para o olho e código para o navegador.
 */
const ASSINATURAS: Record<MimePermitido, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

function ehMimePermitido(mime: string): mime is MimePermitido {
  return (MIMES_PERMITIDOS as readonly string[]).includes(mime);
}

/** O conteúdo real corresponde ao tipo declarado? */
export function assinaturaConfere(bytes: Uint8Array, mime: string): boolean {
  if (!ehMimePermitido(mime)) return false;
  const esperada = ASSINATURAS[mime];
  if (bytes.length < esperada.length) return false;
  return esperada.every((b, i) => bytes[i] === b);
}

/**
 * Prepara o nome para armazenamento como TEXTO.
 *
 * Este nome nunca compõe caminho, URL ou HTML bruto — o caminho no bucket é
 * feito só de UUIDs, e o React escapa na renderização. Por isso preservamos
 * acento e espaço: "Matrícula nº 12.345 — Lote B.pdf" é informação legítima do
 * usuário, e descaracterizá-la não fecha vetor nenhum.
 *
 * Removemos apenas caracteres de controle, que não têm uso legítimo em nome de
 * arquivo e sujam log e terminal.
 */
export function normalizarNomeArquivo(nome: string): string | null {
  // eslint-disable-next-line no-control-regex
  const limpo = nome.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (limpo.length === 0) return null;
  return limpo.slice(0, 255);
}

export function validarArquivo(input: {
  bytes: Uint8Array;
  mime: string;
  nome: string;
  tamanho: number;
}): { ok: true; nome: string } | { ok: false; codigo: CodigoErro; mensagem: string } {
  if (input.tamanho > TAMANHO_MAXIMO_BYTES) {
    const mb = (input.tamanho / 1_048_576).toFixed(0);
    return {
      ok: false,
      codigo: "tamanho",
      mensagem:
        `Este arquivo tem ${mb} MB e o limite é 25 MB. Envie uma versão comprimida ` +
        `ou mande para [PENDÊNCIA: e-mail do admin] que a equipe anexa ao seu processo.`,
    };
  }

  if (!ehMimePermitido(input.mime)) {
    return {
      ok: false,
      codigo: "tipo",
      mensagem: "Aceitamos PDF, JPEG e PNG. Converta o arquivo e tente de novo.",
    };
  }

  if (!assinaturaConfere(input.bytes, input.mime)) {
    // Mensagem deliberadamente vaga: se for tentativa de ataque, não entregamos
    // qual checagem pegou.
    return {
      ok: false,
      codigo: "assinatura",
      mensagem:
        "Não conseguimos validar este arquivo. Ele pode estar corrompido — tente gerar novamente.",
    };
  }

  const nome = normalizarNomeArquivo(input.nome);
  if (nome === null) {
    return { ok: false, codigo: "nome", mensagem: "Nome de arquivo inválido." };
  }

  return { ok: true, nome };
}
