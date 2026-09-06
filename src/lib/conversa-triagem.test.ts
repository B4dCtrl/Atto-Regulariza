import { describe, it, expect } from "vitest";
import { iniciar, avancar, type Estado } from "./conversa-triagem";

/** Roda a conversa inteira com as respostas dadas, devolvendo o estado final. */
function conduzir(entradas: string[]): {
  estado: Estado;
  envios: ReturnType<typeof avancar>["envios"];
} {
  let { estado } = iniciar();
  let envios: ReturnType<typeof avancar>["envios"] = [];
  for (const e of entradas) {
    const passo = avancar(estado, e);
    estado = passo.estado;
    envios = passo.envios;
  }
  return { estado, envios };
}

/** Caminho verde completo. */
const VERDE = [
  "regularizar",
  "casa",
  "Curitiba",
  "propria",
  "nunca_averbada",
  "70_150",
  "Fiz uma edícula e nunca averbei.",
  "Maria Silva",
];

describe("iniciar", () => {
  it("abre no passo 1 e já manda a primeira pergunta", () => {
    const { estado, envios } = iniciar();
    expect(estado.passo).toBe(0);
    expect(estado.encerrada).toBe(false);
    expect(envios.at(-1)?.texto).toContain("O que te trouxe aqui?");
  });

  it("a primeira pergunta vem com as quatro opções", () => {
    const pergunta = iniciar().envios.at(-1);
    expect(pergunta?.tipo).toBe("opcoes");
    expect(pergunta?.tipo === "opcoes" && pergunta.opcoes).toHaveLength(4);
  });
});

describe("avancar — fluxo normal", () => {
  it("cada resposta válida avança um passo", () => {
    let { estado } = iniciar();
    estado = avancar(estado, "regularizar").estado;
    expect(estado.passo).toBe(1);
    expect(estado.respostas.motivo).toBe("regularizar");
  });

  it("aceita texto livre onde a pergunta é aberta", () => {
    const { estado } = conduzir(["regularizar", "casa", "Curitiba"]);
    expect(estado.respostas.cidade).toBe("Curitiba");
    expect(estado.passo).toBe(3);
  });

  it("percorre as oito perguntas e encerra", () => {
    const { estado } = conduzir(VERDE);
    expect(estado.passo).toBe(8);
    expect(estado.encerrada).toBe(true);
  });

  it("no fim manda o resultado da classificação", () => {
    const { envios } = conduzir(VERDE);
    expect(envios.at(-1)?.texto).toContain("Maria");
    expect(envios.at(-1)?.tipo).toBe("texto");
  });

  it("guarda a classificação no estado, para a equipe ver", () => {
    const { estado } = conduzir(VERDE);
    expect(estado.resultado?.cor).toBe("verde");
    expect(estado.resultado?.produto).toBe("habitese");
  });

  it("caminho de contrato de gaveta termina em vermelho", () => {
    const gaveta = [...VERDE];
    gaveta[3] = "gaveta";
    expect(conduzir(gaveta).estado.resultado?.cor).toBe("vermelho");
  });
});

describe("avancar — entrada inválida", () => {
  it("opção que não existe não avança e repete a pergunta", () => {
    const { estado } = iniciar();
    const r = avancar(estado, "qualquer coisa");
    expect(r.estado.passo).toBe(0);
    expect(r.envios.at(-1)?.texto).toContain("O que te trouxe aqui?");
    expect(r.envios[0].texto).toMatch(/toque em uma das opções/i);
  });

  it("texto em branco onde se espera texto também repete", () => {
    let { estado } = iniciar();
    estado = avancar(estado, "regularizar").estado;
    estado = avancar(estado, "casa").estado;
    const r = avancar(estado, "   ");
    expect(r.estado.passo).toBe(2);
  });

  it("conversa encerrada não volta a responder", () => {
    const { estado } = conduzir(VERDE);
    const r = avancar(estado, "oi");
    expect(r.envios).toHaveLength(0);
    expect(r.estado.encerrada).toBe(true);
  });
});

describe("avancar — sair para humano", () => {
  it("quem pede atendente sai do bot na hora", () => {
    const { estado } = iniciar();
    const r = avancar(estado, "quero falar com um atendente");
    expect(r.estado.encerrada).toBe(true);
    expect(r.estado.pediuHumano).toBe(true);
    expect(r.envios.at(-1)?.texto).toMatch(/pessoa da equipe/i);
  });

  it("reconhece variações comuns", () => {
    for (const p of ["ATENDENTE", "quero falar com uma pessoa", "humano"]) {
      expect(avancar(iniciar().estado, p).estado.pediuHumano).toBe(true);
    }
  });

  it("não confunde a palavra dentro de um relato legítimo", () => {
    let { estado } = iniciar();
    for (const e of ["regularizar", "casa", "Curitiba", "propria", "nunca_averbada", "70_150"]) {
      estado = avancar(estado, e).estado;
    }
    const r = avancar(estado, "Falei com um atendente da prefeitura e ele mandou regularizar");
    expect(r.estado.pediuHumano).toBe(false);
    expect(r.estado.respostas.relato).toContain("prefeitura");
  });
});

describe("iniciar — primeira mensagem", () => {
  it("quem já abre pedindo atendente não recebe questionário", () => {
    const r = iniciar("oi, quero falar com um atendente");
    expect(r.estado.pediuHumano).toBe(true);
    expect(r.estado.encerrada).toBe(true);
    expect(r.envios).toHaveLength(1);
    expect(r.envios[0].texto).toMatch(/pessoa da equipe/i);
  });

  it("mensagem comum começa a triagem normalmente", () => {
    const r = iniciar("oi");
    expect(r.estado.pediuHumano).toBe(false);
    expect(r.envios.at(-1)?.texto).toContain("O que te trouxe aqui?");
  });

  it("sem texto nenhum também começa a triagem", () => {
    expect(iniciar().envios).toHaveLength(2);
  });
});
