import { describe, it, expect } from "vitest";
import { intakeDaTriagem } from "./triagem-para-intake";

describe("intakeDaTriagem — tipo de imóvel", () => {
  it("passa direto o que os dois lados chamam igual", () => {
    expect(intakeDaTriagem({ imovel: "casa" }).tipo_imovel).toBe("casa");
    expect(intakeDaTriagem({ imovel: "apartamento" }).tipo_imovel).toBe("apartamento");
    expect(intakeDaTriagem({ imovel: "terreno" }).tipo_imovel).toBe("terreno");
    expect(intakeDaTriagem({ imovel: "comercial" }).tipo_imovel).toBe("comercial");
  });
});

describe("intakeDaTriagem — escritura", () => {
  it("matrícula própria ou em outro nome: a matrícula existe", () => {
    expect(intakeDaTriagem({ matricula: "propria" }).tem_escritura).toBe("sim");
    expect(intakeDaTriagem({ matricula: "outro_nome" }).tem_escritura).toBe("sim");
  });

  it("contrato de gaveta: não há registro", () => {
    expect(intakeDaTriagem({ matricula: "gaveta" }).tem_escritura).toBe("nao");
  });

  it("quem não sabe fica em branco, para responder no wizard", () => {
    expect(intakeDaTriagem({ matricula: "nao_sei" }).tem_escritura).toBe("");
  });
});

describe("intakeDaTriagem — situação", () => {
  it("construção não averbada e ampliação viram falta de habite-se", () => {
    expect(intakeDaTriagem({ matricula: "propria", divergencia: "nunca_averbada" }).situacao).toBe(
      "sem_habite",
    );
    expect(intakeDaTriagem({ matricula: "propria", divergencia: "ampliacao" }).situacao).toBe(
      "sem_habite",
    );
  });

  it("área que não bate vira retificação", () => {
    expect(intakeDaTriagem({ matricula: "propria", divergencia: "area_nao_bate" }).situacao).toBe(
      "retificacao",
    );
  });

  it("herança manda na situação, mesmo com outra divergência", () => {
    const r = intakeDaTriagem({
      matricula: "propria",
      motivo: "heranca",
      divergencia: "area_nao_bate",
    });
    expect(r.situacao).toBe("heranca");
  });

  it("sem registro, a situação vem da outra lista", () => {
    const r = intakeDaTriagem({ matricula: "gaveta", divergencia: "nunca_averbada" });
    expect(r.situacao).toBe("sem_escritura");
  });

  it("herança sem registro tem opção própria", () => {
    const r = intakeDaTriagem({ matricula: "gaveta", motivo: "heranca" });
    expect(r.situacao).toBe("heranca_s_doc");
  });

  it("sem saber o que diverge, fica em branco", () => {
    expect(intakeDaTriagem({ matricula: "propria", divergencia: "nao_sei" }).situacao).toBe("");
  });
});

describe("intakeDaTriagem — objetivo", () => {
  it("traduz o motivo para a frase do wizard", () => {
    expect(intakeDaTriagem({ motivo: "vender" }).objetivo).toBe("Quero vender o imóvel");
    expect(intakeDaTriagem({ motivo: "heranca" }).objetivo).toBe("Deixar em ordem para herança");
    expect(intakeDaTriagem({ motivo: "regularizar" }).objetivo).toBe(
      "Regularizar para uso pessoal",
    );
  });

  it("notificação não tem objetivo equivalente e fica em branco", () => {
    expect(intakeDaTriagem({ motivo: "notificacao" }).objetivo).toBe("");
  });
});

describe("intakeDaTriagem — resto", () => {
  it("leva nome, cidade e área", () => {
    const r = intakeDaTriagem({ nome: "Tais Silva", cidade: "Curitiba", area: "70_150" });
    expect(r.nome).toBe("Tais Silva");
    expect(r.cidade).toBe("Curitiba");
    expect(r.area_m2).toBe("70 a 150");
  });

  it("nunca inventa o estado — a triagem não pergunta", () => {
    expect(intakeDaTriagem({ cidade: "Curitiba" }).estado).toBe("");
  });

  it("respostas vazias devolvem tudo em branco, sem quebrar", () => {
    const r = intakeDaTriagem({});
    expect(Object.values(r).every((v) => v === "")).toBe(true);
  });
});
