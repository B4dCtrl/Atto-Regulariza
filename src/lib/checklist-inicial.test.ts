import { describe, it, expect } from "vitest";
import {
  CHECKLIST_PADRAO,
  KINDS_ESSENCIAIS,
  faltamDoChecklist,
  essenciaisAprovados,
  rotulosDe,
  type DocumentoResumo,
} from "./checklist-inicial";

function doc(over: Partial<DocumentoResumo> = {}): DocumentoResumo {
  return { kind: "identidade", status: "Enviado", deleted_at: null, ...over };
}

describe("CHECKLIST_PADRAO", () => {
  it("tem os três documentos do protocolo inicial", () => {
    expect([...CHECKLIST_PADRAO]).toEqual(["identidade", "comprovante_endereco", "matricula"]);
  });

  it("os essenciais são identidade e comprovante de endereço", () => {
    expect([...KINDS_ESSENCIAIS]).toEqual(["identidade", "comprovante_endereco"]);
  });
});

describe("faltamDoChecklist", () => {
  it("lista os três quando nada foi enviado", () => {
    expect(faltamDoChecklist([])).toEqual([
      "identidade",
      "comprovante_endereco",
      "matricula",
    ]);
  });

  it("não conta documento excluído como entregue", () => {
    const docs = [doc({ kind: "identidade", deleted_at: "2026-08-24T10:00:00Z" })];
    expect(faltamDoChecklist(docs)).toContain("identidade");
  });

  it("conta qualquer status como entregue — enviar já basta para sair da lista", () => {
    // O checklist mede ENVIO, não aprovação: quem enviou fez a parte dele e não
    // deve continuar vendo o item como pendente enquanto a equipe confere.
    const docs = [doc({ kind: "identidade", status: "Enviado" })];
    expect(faltamDoChecklist(docs)).not.toContain("identidade");
  });

  it("devolve lista vazia quando os três chegaram", () => {
    const docs = [
      doc({ kind: "identidade" }),
      doc({ kind: "comprovante_endereco" }),
      doc({ kind: "matricula" }),
    ];
    expect(faltamDoChecklist(docs)).toEqual([]);
  });

  it("ignora documento fora do checklist", () => {
    const docs = [doc({ kind: "iptu" })];
    expect(faltamDoChecklist(docs)).toHaveLength(3);
  });
});

describe("essenciaisAprovados", () => {
  it("é falso sem nenhum documento", () => {
    expect(essenciaisAprovados([])).toBe(false);
  });

  it("é falso com essencial apenas enviado", () => {
    const docs = [
      doc({ kind: "identidade", status: "Enviado" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(false);
  });

  it("é verdadeiro com os dois essenciais aprovados", () => {
    const docs = [
      doc({ kind: "identidade", status: "Aprovado" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(true);
  });

  it("não aceita essencial aprovado que foi excluído depois", () => {
    const docs = [
      doc({ kind: "identidade", status: "Aprovado", deleted_at: "2026-08-24T10:00:00Z" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(false);
  });

  it("não exige matrícula — ela não trava", () => {
    const docs = [
      doc({ kind: "identidade", status: "Aprovado" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(true);
  });
});

describe("rotulosDe", () => {
  it("junta os rótulos legíveis com vírgula", () => {
    expect(rotulosDe(["identidade", "matricula"])).toBe(
      "RG e CPF do proprietário, Matrícula / escritura",
    );
  });

  it("devolve vazio para lista vazia", () => {
    expect(rotulosDe([])).toBe("");
  });
});
