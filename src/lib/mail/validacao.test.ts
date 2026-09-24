import { describe, it, expect } from "vitest";
import { schemaAtribuir, schemaEnviar, schemaListar, schemaMessageId } from "./validacao";

const ok = {
  de: "tais@atoregulariza.com.br",
  para: ["cliente@gmail.com"],
  assunto: "Oi",
  texto: "Olá",
};

describe("schemaEnviar", () => {
  it("aceita envio válido", () => expect(schemaEnviar.safeParse(ok).success).toBe(true));
  it("recusa remetente fora da lista", () =>
    expect(schemaEnviar.safeParse({ ...ok, de: "ceo@atoregulariza.com.br" }).success).toBe(false));
  it("recusa destinatário inválido", () =>
    expect(schemaEnviar.safeParse({ ...ok, para: ["nao-e-email"] }).success).toBe(false));
  it("recusa mais de 10 destinatários", () =>
    expect(
      schemaEnviar.safeParse({ ...ok, para: Array.from({ length: 11 }, (_, i) => `a${i}@x.com`) })
        .success,
    ).toBe(false));
  it("recusa quebra de linha no assunto (injeção de cabeçalho)", () =>
    expect(schemaEnviar.safeParse({ ...ok, assunto: "Oi\r\nBcc: x@y.com" }).success).toBe(false));
  it("recusa texto vazio", () =>
    expect(schemaEnviar.safeParse({ ...ok, texto: "   " }).success).toBe(false));
});

describe("schemaListar", () => {
  it("recusa pasta inventada", () =>
    expect(
      schemaListar.safeParse({ pasta: "INBOX.Trash", pagina: 0, visao: "todos" }).success,
    ).toBe(false));
  it("aceita as visões", () => {
    for (const visao of ["todos", "geral", "tais@atoregulariza.com.br"])
      expect(schemaListar.safeParse({ pasta: "entrada", pagina: 0, visao }).success).toBe(true);
  });
  it("recusa endereço de setor como visão (contato@ bateria em tudo)", () =>
    expect(
      schemaListar.safeParse({ pasta: "entrada", pagina: 0, visao: "contato@atoregulariza.com.br" })
        .success,
    ).toBe(false));
});

describe("schemaMessageId", () => {
  const ok = (v: string) => schemaMessageId.safeParse(v).success;
  it("aceita Message-ID comum", () => {
    expect(ok("<CAF=abc.123+x@mail.gmail.com>")).toBe(true);
    expect(ok("<20260924.1@atoregulariza.com.br>")).toBe(true);
  });
  it("exige < > e @", () => {
    expect(ok("abc@x.com")).toBe(false);
    expect(ok("<semarroba>")).toBe(false);
  });
  it("recusa espaço, aspas, barra invertida e < > no meio", () => {
    expect(ok("<a b@x>")).toBe(false);
    expect(ok('<a"b@x>')).toBe(false);
    expect(ok("<a\\b@x>")).toBe(false);
    expect(ok("<a<b@x>")).toBe(false);
    expect(ok("<a@x>\r\nBcc: y@z")).toBe(false);
  });
  it("recusa não-ASCII e tamanho absurdo", () => {
    expect(ok("<ação@x>")).toBe(false);
    expect(ok(`<${"a".repeat(600)}@x>`)).toBe(false);
  });
});

describe("schemaAtribuir", () => {
  const base = { pasta: "entrada", uid: 7 };
  it("aceita as três pessoas e null", () => {
    for (const responsavel of [
      "gabriel@atoregulariza.com.br",
      "tais@atoregulariza.com.br",
      "lauro@atoregulariza.com.br",
      null,
    ])
      expect(schemaAtribuir.safeParse({ ...base, responsavel }).success).toBe(true);
  });
  it("recusa setor, estranho e campo ausente", () => {
    expect(
      schemaAtribuir.safeParse({ ...base, responsavel: "contato@atoregulariza.com.br" }).success,
    ).toBe(false);
    expect(schemaAtribuir.safeParse({ ...base, responsavel: "x@y.com" }).success).toBe(false);
    expect(schemaAtribuir.safeParse(base).success).toBe(false);
  });
});
