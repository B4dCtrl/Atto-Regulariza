import { describe, it, expect } from "vitest";
import {
  buscaDaVisao,
  visoesDaMensagem,
  visaoPadrao,
  visaoParaContar,
  LIMITE_ATRIBUIDOS_NA_BUSCA,
  VISOES,
  type Busca,
} from "./visoes";
import { descobrirAlias } from "./enderecos";
import type { Pasta } from "./validacao";

const CONTATO = "contato@atoregulariza.com.br";
const SUPORTE = "suporte@atoregulariza.com.br";
const TAIS = "tais@atoregulariza.com.br";
const GABRIEL = "gabriel@atoregulariza.com.br";
const LAURO = "lauro@atoregulariza.com.br";

type Msg = {
  to?: string[];
  cc?: string[];
  deliveredTo?: string[];
  from?: string[];
  messageId?: string;
  atribuido?: typeof TAIS | typeof GABRIEL | typeof LAURO | null;
};

/**
 * Um servidor IMAP de mentira: avalia a busca como o Dovecot avalia (termo de
 * cabeçalho = "contém", sem diferenciar maiúsculas). Serve para provar que a
 * busca enviada à Hostinger devolve exatamente as mensagens da regra.
 */
function casa(b: Busca, m: Msg): boolean {
  const contem = (valores: string[] | undefined, termo: string) =>
    (valores ?? []).some((v) => v.toLowerCase().includes(termo.toLowerCase()));
  const testes: boolean[] = [];
  if (b.all) testes.push(true);
  if (b.to !== undefined) testes.push(contem(m.to, b.to));
  if (b.cc !== undefined) testes.push(contem(m.cc, b.cc));
  if (b.from !== undefined) testes.push(contem(m.from, b.from));
  if (b.header) {
    for (const [h, v] of Object.entries(b.header)) {
      if (h === "delivered-to") testes.push(contem(m.deliveredTo, v));
      else if (h === "message-id") testes.push(contem(m.messageId ? [m.messageId] : [], v));
      else throw new Error(`cabeçalho não previsto: ${h}`);
    }
  }
  if (b.or) {
    if (b.or.length === 0) throw new Error("OR vazio vira 'tudo' no imapflow");
    testes.push(b.or.some((x) => casa(x, m)));
  }
  if (b.not) testes.push(!casa(b.not, m));
  if (testes.length === 0) throw new Error("busca vazia");
  return testes.every(Boolean);
}

const idTais = "<abc123@mail.cliente.com>";
const amostra: Msg[] = [
  { to: [TAIS], deliveredTo: [CONTATO] },
  { to: [CONTATO], deliveredTo: [CONTATO] },
  { to: [SUPORTE], cc: [GABRIEL], deliveredTo: [CONTATO] },
  { to: ["lista@x.com"], deliveredTo: [LAURO, CONTATO] },
  { to: [CONTATO], deliveredTo: [CONTATO], messageId: idTais, atribuido: TAIS },
  { to: [GABRIEL], deliveredTo: [CONTATO], messageId: "<g@x>", atribuido: TAIS },
  { to: ["outro@x.com"] },
  { from: [TAIS], to: ["cliente@x.com"] },
  { from: [CONTATO], to: ["cliente@x.com"] },
  { from: [SUPORTE], to: ["cliente@x.com"] },
  { from: [LAURO], to: ["cliente@x.com"], messageId: "<l@x>", atribuido: GABRIEL },
  { from: ["alguem@fora.com"], to: [CONTATO] },
];

function atribuidosA(p: string): string[] {
  return amostra.filter((m) => m.atribuido === p && m.messageId).map((m) => m.messageId!);
}

describe("visoesDaMensagem (entrada)", () => {
  it("Delivered-To contato@ e To tais@ é da Taís, não do Geral", () => {
    const v = visoesDaMensagem("entrada", { to: [TAIS], deliveredTo: [CONTATO] });
    expect(v).toContain(TAIS);
    expect(v).not.toContain("geral");
  });

  it("só contato@/suporte@ é Geral", () => {
    expect(visoesDaMensagem("entrada", { to: [CONTATO], deliveredTo: [CONTATO] })).toEqual([
      "todos",
      "geral",
    ]);
    expect(visoesDaMensagem("entrada", { to: [SUPORTE] })).toEqual(["todos", "geral"]);
  });

  it("alias pessoal ganha de suporte@ também", () => {
    const v = visoesDaMensagem("entrada", { to: [SUPORTE], cc: [GABRIEL] });
    expect(v).toEqual(["todos", GABRIEL]);
  });

  it("cópia oculta (só Delivered-To) conta para a pessoa", () => {
    expect(
      visoesDaMensagem("entrada", {
        to: ["x@y.com"],
        deliveredTo: ["<lauro@atoregulariza.com.br>"],
      }),
    ).toEqual(["todos", LAURO]);
  });

  it("mandado a duas pessoas aparece nas duas", () => {
    expect(visoesDaMensagem("entrada", { to: [TAIS], cc: [LAURO] })).toEqual([
      "todos",
      TAIS,
      LAURO,
    ]);
  });

  it("atribuído entra na caixa da pessoa sem sair de onde estava", () => {
    expect(visoesDaMensagem("entrada", { to: [CONTATO], atribuido: TAIS })).toEqual([
      "todos",
      "geral",
      TAIS,
    ]);
    expect(visoesDaMensagem("entrada", { to: [GABRIEL], atribuido: TAIS })).toEqual([
      "todos",
      GABRIEL,
      TAIS,
    ]);
  });

  it("Geral bate com descobrirAlias em contato@/suporte@", () => {
    for (const m of amostra.filter((x) => !x.from)) {
      const alias = descobrirAlias(m);
      const geral = visoesDaMensagem("entrada", m).includes("geral");
      expect(geral).toBe(alias === CONTATO || alias === SUPORTE);
    }
  });
});

describe("visoesDaMensagem (enviados)", () => {
  it("pessoa vê o que saiu do alias dela", () => {
    expect(visoesDaMensagem("enviados", { from: [TAIS], to: [CONTATO] })).toEqual(["todos", TAIS]);
  });

  it("Geral vê o que saiu de contato@ ou suporte@", () => {
    expect(visoesDaMensagem("enviados", { from: [CONTATO] })).toEqual(["todos", "geral"]);
    expect(
      visoesDaMensagem("enviados", { from: ['"Suporte" <suporte@atoregulariza.com.br>'] }),
    ).toEqual(["todos", "geral"]);
  });

  it("destinatário não importa em Enviados", () => {
    expect(visoesDaMensagem("enviados", { from: ["x@fora.com"], to: [TAIS] })).toEqual(["todos"]);
  });
});

describe("buscaDaVisao", () => {
  it("Todos é a caixa inteira", () => {
    expect(buscaDaVisao("entrada", "todos")).toEqual({ all: true });
    expect(buscaDaVisao("enviados", "todos", [idTais])).toEqual({ all: true });
  });

  it("Geral nunca busca 'mandado a contato@' (bateria em tudo pelo Delivered-To)", () => {
    expect(JSON.stringify(buscaDaVisao("entrada", "geral"))).not.toContain(CONTATO);
  });

  it("sem atribuições, a pessoa ainda tem termos (nunca OR vazio)", () => {
    const b = buscaDaVisao("entrada", LAURO, []);
    expect(b.or?.length).toBe(3);
  });

  it("limita as atribuições que entram na busca", () => {
    const ids = Array.from({ length: LIMITE_ATRIBUIDOS_NA_BUSCA + 50 }, (_, i) => `<${i}@x>`);
    expect(buscaDaVisao("entrada", TAIS, ids).or?.length).toBe(3 + LIMITE_ATRIBUIDOS_NA_BUSCA);
  });

  it.each<Pasta>(["entrada", "enviados"])(
    "em %s, devolve exatamente as mensagens da regra, em toda visão",
    (pasta) => {
      for (const visao of VISOES) {
        const ids = visao === "todos" || visao === "geral" ? [] : atribuidosA(visao);
        const b = buscaDaVisao(pasta, visao, ids);
        for (const m of amostra) {
          expect({ visao, m, casa: casa(b, m) }).toEqual({
            visao,
            m,
            casa: visoesDaMensagem(pasta, m).includes(visao),
          });
        }
      }
    },
  );
});

describe("visaoPadrao", () => {
  it("alias pessoal abre na própria caixa", () => {
    expect(visaoPadrao("tais@atoregulariza.com.br")).toBe(TAIS);
    expect(visaoPadrao(" Gabriel@AtoRegulariza.com.br ")).toBe(GABRIEL);
    expect(visaoPadrao("lauro@atoregulariza.com.br")).toBe(LAURO);
  });

  it("dono abre em Todos", () => {
    expect(visaoPadrao("ozanchet@gmail.com")).toBe("todos");
  });

  it("outro admin, contato@ ou sem e-mail abre em Todos", () => {
    expect(visaoPadrao("outro.admin@gmail.com")).toBe("todos");
    expect(visaoPadrao(CONTATO)).toBe("todos");
    expect(visaoPadrao(null)).toBe("todos");
  });
});

describe("visaoParaContar", () => {
  it("pessoa conta a própria visão; dono, tudo", () => {
    expect(visaoParaContar(TAIS)).toBe(TAIS);
    expect(visaoParaContar("inteira")).toBe("todos");
  });

  it("contato@/suporte@ contam o Geral, nunca a caixa inteira", () => {
    expect(visaoParaContar(CONTATO)).toBe("geral");
    expect(visaoParaContar(SUPORTE)).toBe("geral");
  });

  it("sem caixa, não conta", () => expect(visaoParaContar(null)).toBeNull());
});
