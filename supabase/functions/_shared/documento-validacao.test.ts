import { describe, it, expect } from "vitest";
import {
  TAMANHO_MAXIMO_BYTES,
  assinaturaConfere,
  normalizarNomeArquivo,
  validarArquivo,
} from "./documento-validacao";

/** Monta bytes iniciais seguidos de lixo, simulando um arquivo real. */
function comAssinatura(...prefixo: number[]): Uint8Array {
  return new Uint8Array([...prefixo, 0x00, 0x01, 0x02, 0x03]);
}

const PDF = comAssinatura(0x25, 0x50, 0x44, 0x46, 0x2d);
const JPEG = comAssinatura(0xff, 0xd8, 0xff);
const PNG = comAssinatura(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
// "<html>" — o disfarce clássico
const HTML = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]);

describe("assinaturaConfere", () => {
  it("aceita PDF, JPEG e PNG legítimos", () => {
    expect(assinaturaConfere(PDF, "application/pdf")).toBe(true);
    expect(assinaturaConfere(JPEG, "image/jpeg")).toBe(true);
    expect(assinaturaConfere(PNG, "image/png")).toBe(true);
  });

  it("recusa HTML que se declara PDF", () => {
    expect(assinaturaConfere(HTML, "application/pdf")).toBe(false);
  });

  it("recusa PDF que se declara imagem", () => {
    expect(assinaturaConfere(PDF, "image/png")).toBe(false);
  });

  it("recusa arquivo curto demais para ter assinatura", () => {
    expect(assinaturaConfere(new Uint8Array([0x25]), "application/pdf")).toBe(false);
  });

  it("recusa tipo fora da lista mesmo com bytes coerentes", () => {
    const svg = new Uint8Array([0x3c, 0x73, 0x76, 0x67]);
    expect(assinaturaConfere(svg, "image/svg+xml")).toBe(false);
  });
});

describe("normalizarNomeArquivo", () => {
  it("preserva acento e espaço", () => {
    expect(normalizarNomeArquivo("Matrícula nº 12.345 — Lote B.pdf")).toBe(
      "Matrícula nº 12.345 — Lote B.pdf",
    );
  });

  it("remove caracteres de controle", () => {
    expect(normalizarNomeArquivo("nota\x00\x1ffiscal.pdf")).toBe("notafiscal.pdf");
  });

  it("corta em 255 caracteres", () => {
    const longo = "a".repeat(300) + ".pdf";
    expect(normalizarNomeArquivo(longo)!.length).toBe(255);
  });

  it("devolve null para nome vazio ou só espaços", () => {
    expect(normalizarNomeArquivo("")).toBeNull();
    expect(normalizarNomeArquivo("   ")).toBeNull();
    expect(normalizarNomeArquivo("\x00")).toBeNull();
  });

  it("mantém o nome intacto mesmo com sequência de travessia", () => {
    // Não é papel desta função barrar travessia: o nome nunca compõe caminho.
    // Guardar o texto original é correto; o caminho é feito só de UUIDs.
    expect(normalizarNomeArquivo("../../etc/passwd")).toBe("../../etc/passwd");
  });
});

describe("validarArquivo", () => {
  const base = { bytes: PDF, mime: "application/pdf", nome: "doc.pdf", tamanho: 1000 };

  it("aceita um PDF válido", () => {
    const r = validarArquivo(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nome).toBe("doc.pdf");
  });

  it("recusa acima do limite", () => {
    const r = validarArquivo({ ...base, tamanho: TAMANHO_MAXIMO_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("tamanho");
  });

  it("recusa tipo não permitido", () => {
    const r = validarArquivo({ ...base, mime: "image/svg+xml" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("tipo");
  });

  it("recusa conteúdo que não bate com o tipo declarado", () => {
    const r = validarArquivo({ ...base, bytes: HTML });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("assinatura");
  });

  it("recusa nome vazio", () => {
    const r = validarArquivo({ ...base, nome: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("nome");
  });

  it("não revela qual checagem falhou na mensagem de assinatura", () => {
    const r = validarArquivo({ ...base, bytes: HTML });
    if (!r.ok) {
      expect(r.mensagem).not.toMatch(/assinatura|magic|byte/i);
      expect(r.mensagem).toMatch(/corrompido/i);
    }
  });
});
