import { describe, it, expect } from "vitest";
import { validarCPF, formatarCPF, validarEmail, validarTelefone } from "./validacao-br";

describe("validarCPF", () => {
  it("aceita CPF válido com pontuação", () => {
    expect(validarCPF("529.982.247-25")).toBe(true);
  });

  it("aceita o mesmo CPF sem pontuação", () => {
    expect(validarCPF("52998224725")).toBe(true);
  });

  it("aceita CPF cujo dígito verificador é 0 (resto 10 vira 0)", () => {
    // 111.444.777-35 é o exemplo canônico da Receita.
    expect(validarCPF("11144477735")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(validarCPF("529.982.247-26")).toBe(false);
  });

  it("recusa todos os dígitos iguais", () => {
    for (const d of "0123456789") {
      expect(validarCPF(d.repeat(11))).toBe(false);
    }
  });

  it("recusa quantidade de dígitos diferente de 11", () => {
    expect(validarCPF("5299822472")).toBe(false);
    expect(validarCPF("529982247251")).toBe(false);
  });

  it("recusa vazio e só pontuação", () => {
    expect(validarCPF("")).toBe(false);
    expect(validarCPF("...-")).toBe(false);
  });

  it("recusa letras misturadas", () => {
    expect(validarCPF("529.982.24a-25")).toBe(false);
  });
});

describe("formatarCPF", () => {
  it("põe pontos e traço conforme o usuário digita", () => {
    expect(formatarCPF("529")).toBe("529");
    expect(formatarCPF("529982")).toBe("529.982");
    expect(formatarCPF("529982247")).toBe("529.982.247");
    expect(formatarCPF("52998224725")).toBe("529.982.247-25");
  });

  it("descarta o que passar de 11 dígitos", () => {
    expect(formatarCPF("5299822472599")).toBe("529.982.247-25");
  });

  it("ignora o que não for dígito", () => {
    expect(formatarCPF("529abc982")).toBe("529.982");
  });
});

describe("validarEmail", () => {
  it("aceita endereço comum", () => {
    expect(validarEmail("maria@exemplo.com.br")).toBe(true);
  });

  it("aceita alias com +", () => {
    expect(validarEmail("ozanchet+teste1@gmail.com")).toBe(true);
  });

  it("recusa sem arroba", () => {
    expect(validarEmail("maria.exemplo.com")).toBe(false);
  });

  it("recusa sem domínio", () => {
    expect(validarEmail("maria@")).toBe(false);
  });

  it("recusa sem ponto no domínio", () => {
    expect(validarEmail("maria@exemplo")).toBe(false);
  });

  it("recusa espaço no meio", () => {
    expect(validarEmail("maria silva@exemplo.com")).toBe(false);
  });
});

describe("validarTelefone", () => {
  it("aceita celular com 11 dígitos", () => {
    expect(validarTelefone("(41) 98447-1404")).toBe(true);
  });

  it("aceita fixo com 10 dígitos", () => {
    expect(validarTelefone("4133334444")).toBe(true);
  });

  it("recusa DDD inexistente", () => {
    expect(validarTelefone("(00) 98447-1404")).toBe(false);
  });

  it("recusa quantidade errada de dígitos", () => {
    expect(validarTelefone("419844714")).toBe(false);
  });
});
