import { describe, it, expect } from "vitest";
import { DOCUMENT_KINDS, kindsPara, rotuloDoKind } from "./document-kinds";

describe("DOCUMENT_KINDS", () => {
  it("não tem kind repetido", () => {
    const kinds = DOCUMENT_KINDS.map((k) => k.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("todo kind tem rótulo não vazio", () => {
    for (const k of DOCUMENT_KINDS) expect(k.label.length).toBeGreaterThan(0);
  });
});

describe("kindsPara", () => {
  it("oferece ao cliente os documentos dele e 'outro'", () => {
    const kinds = kindsPara("cliente").map((k) => k.kind);
    expect(kinds).toContain("matricula");
    expect(kinds).toContain("iptu");
    expect(kinds).toContain("outro");
  });

  it("não oferece peça técnica ao cliente", () => {
    const kinds = kindsPara("cliente").map((k) => k.kind);
    expect(kinds).not.toContain("art_rrt");
    expect(kinds).not.toContain("laudo");
    expect(kinds).not.toContain("projeto");
  });

  it("oferece ao profissional todos os tipos", () => {
    expect(kindsPara("profissional").length).toBe(DOCUMENT_KINDS.length);
  });
});

describe("rotuloDoKind", () => {
  it("traduz um kind conhecido", () => {
    expect(rotuloDoKind("matricula")).toBe("Matrícula / escritura");
  });

  it("devolve rótulo genérico para kind desconhecido", () => {
    expect(rotuloDoKind("inexistente")).toBe("Documento");
  });
});
