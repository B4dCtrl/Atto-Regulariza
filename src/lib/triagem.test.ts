import { describe, it, expect } from "vitest";
import {
  PERGUNTAS,
  classificar,
  descreverRespostas,
  nomeDoProduto,
  type Respostas,
} from "./triagem";

/** Caso base: tudo tranquilo, dono com matrícula no próprio nome. */
const base: Respostas = {
  motivo: "regularizar",
  imovel: "casa",
  cidade: "Curitiba",
  matricula: "propria",
  divergencia: "nunca_averbada",
  area: "70_150",
  relato: "Construí uma edícula nos fundos e nunca averbei.",
  nome: "Maria",
};

describe("PERGUNTAS", () => {
  it("tem as oito perguntas, na ordem da triagem", () => {
    expect(PERGUNTAS.map((p) => p.id)).toEqual([
      "motivo",
      "imovel",
      "cidade",
      "matricula",
      "divergencia",
      "area",
      "relato",
      "nome",
    ]);
  });

  it("marca como texto livre só cidade, relato e nome", () => {
    const livres = PERGUNTAS.filter((p) => p.tipo === "texto").map((p) => p.id);
    expect(livres).toEqual(["cidade", "relato", "nome"]);
  });
});

describe("classificar — vermelho", () => {
  it("matrícula em outro nome é questão dominial", () => {
    const r = classificar({ ...base, matricula: "outro_nome" });
    expect(r.cor).toBe("vermelho");
    expect(r.motivo).toMatch(/nome de outra pessoa/i);
  });

  it("contrato de gaveta também", () => {
    expect(classificar({ ...base, matricula: "gaveta" }).cor).toBe("vermelho");
  });

  it("vence a notificação: quem manda é a titularidade", () => {
    const r = classificar({ ...base, motivo: "notificacao", matricula: "gaveta" });
    expect(r.cor).toBe("vermelho");
  });

  it("não sugere preço quando é vermelho", () => {
    expect(classificar({ ...base, matricula: "outro_nome" }).faixa).toBeNull();
  });
});

describe("classificar — amarelo", () => {
  it("notificação tem prazo e prefeitura no meio", () => {
    const r = classificar({ ...base, motivo: "notificacao" });
    expect(r.cor).toBe("amarelo");
    expect(r.motivo).toMatch(/prazo/i);
  });

  it("herança cai em inventário, que é sob consulta", () => {
    expect(classificar({ ...base, motivo: "heranca" }).cor).toBe("amarelo");
  });

  it("não saber de quem é a matrícula precisa de conferência", () => {
    expect(classificar({ ...base, matricula: "nao_sei" }).cor).toBe("amarelo");
  });

  it("acima de 300 m² sai da faixa padrão", () => {
    const r = classificar({ ...base, area: "mais_300" });
    expect(r.cor).toBe("amarelo");
    expect(r.faixa).toBeNull();
  });
});

describe("classificar — verde", () => {
  it("dono com matrícula própria e caso comum", () => {
    const r = classificar(base);
    expect(r.cor).toBe("verde");
    expect(r.faixa).toContain("R$");
  });

  it("construção nunca averbada é habite-se", () => {
    expect(classificar(base).produto).toBe("habitese");
  });

  it("ampliação também é habite-se", () => {
    expect(classificar({ ...base, divergencia: "ampliacao" }).produto).toBe("habitese");
  });

  it("área que não bate é retificação", () => {
    const r = classificar({ ...base, divergencia: "area_nao_bate" });
    expect(r.produto).toBe("retificacao");
    expect(r.faixa).toContain("2.899");
  });

  it("sem saber a divergência, segue verde mas sem preço", () => {
    const r = classificar({ ...base, divergencia: "nao_sei" });
    expect(r.cor).toBe("verde");
    expect(r.produto).toBeNull();
    expect(r.faixa).toBeNull();
  });
});

describe("classificar — roteamento e relato", () => {
  it("devolve a cidade para achar o profissional da região", () => {
    expect(classificar({ ...base, cidade: " São José dos Pinhais " }).cidade).toBe(
      "São José dos Pinhais",
    );
  });

  it("preserva o relato, que é o que a IA lê", () => {
    expect(classificar(base).relato).toBe(base.relato);
  });

  it("usa o nome na saudação", () => {
    expect(classificar(base).mensagem).toContain("Maria");
  });

  it("aguenta nome vazio sem quebrar a frase", () => {
    const r = classificar({ ...base, nome: "  " });
    expect(r.mensagem).not.toContain("undefined");
    expect(r.mensagem.trim().length).toBeGreaterThan(0);
  });
});

describe("descreverRespostas", () => {
  it("traduz o valor guardado no rótulo que a equipe lê", () => {
    const d = descreverRespostas({ divergencia: "nunca_averbada" });
    expect(d).toEqual([
      {
        pergunta: "O que está diferente do que consta no papel?",
        resposta: "Construção nunca averbada",
      },
    ]);
  });

  it("mantém texto livre como está", () => {
    const d = descreverRespostas({ cidade: "São José dos Pinhais" });
    expect(d[0].resposta).toBe("São José dos Pinhais");
  });

  it("segue a ordem das perguntas, não a ordem do objeto", () => {
    const d = descreverRespostas({ nome: "Tais", motivo: "vender", cidade: "Curitiba" });
    expect(d.map((x) => x.resposta)).toEqual(["Vender ou financiar", "Curitiba", "Tais"]);
  });

  it("pula o que não foi respondido", () => {
    expect(descreverRespostas({})).toEqual([]);
    expect(descreverRespostas({ cidade: "" })).toEqual([]);
  });

  it("valor desconhecido aparece cru em vez de sumir", () => {
    const d = descreverRespostas({ motivo: "algo_novo" as never });
    expect(d[0].resposta).toBe("algo_novo");
  });
});

describe("nomeDoProduto", () => {
  it("dá o nome que a equipe usa", () => {
    expect(nomeDoProduto("habitese")).toBe("habite-se / averbação da construção");
    expect(nomeDoProduto("retificacao")).toBe("retificação de área");
  });

  it("sem produto identificado devolve null", () => {
    expect(nomeDoProduto(null)).toBeNull();
  });
});
