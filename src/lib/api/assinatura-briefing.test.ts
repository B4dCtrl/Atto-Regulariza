import { describe, it, expect } from "vitest";
import { assinaturaBriefing, decidirBriefing, INTERVALO_MINIMO_MS } from "./assinatura-briefing";
import { inicioDaJanela, type DadosGerenciais } from "./resumo-gerencial";

function dados(over: Partial<DadosGerenciais> = {}): DadosGerenciais {
  return {
    profissionaisPendentes: [
      { nome: "João", desde: "2026-09-20T12:00:00Z" },
      { nome: "Ana", desde: "2026-09-21T12:00:00Z" },
    ],
    aprovacoesPendentes: [
      { tipo: "orcamento", processo: "#A3F00000", desde: "2026-09-22T12:00:00Z" },
    ],
    processosParados: [
      {
        id: "a3f00000-0000-0000-0000-000000000000",
        nome: "Casa 1",
        etapa: 2,
        paradoDesde: "2026-09-10T12:00:00Z",
        cliente: "Maria",
        clienteUltimoAcesso: null,
        documentosPendentes: 1,
      },
      {
        id: "b4000000-0000-0000-0000-000000000000",
        nome: "Casa 2",
        etapa: 4,
        paradoDesde: "2026-09-12T12:00:00Z",
        cliente: "José",
        clienteUltimoAcesso: "2026-09-13T12:00:00Z",
        documentosPendentes: 0,
      },
    ],
    leadsSemResposta: [{ cidade: "Curitiba", uf: "PR", desde: "2026-09-23T12:00:00Z" }],
    profissionaisInativos: [{ nome: "Pedro", processos: 2, ultimoAcesso: null }],
    movimento: {
      contasNovas: { cliente: 2, profissional: 1, admin: 0 },
      acessos: { cliente: 5, profissional: 2, admin: 4 },
      pessoasQueEntraram: 6,
      leadsNovos: 3,
      processosNovos: 1,
      documentosEnviados: 4,
      mensagensTrocadas: 10,
      etapasConcluidas: 2,
    },
    ...over,
  };
}

describe("assinaturaBriefing", () => {
  it("é a mesma para os mesmos dados", () => {
    expect(assinaturaBriefing(dados())).toBe(assinaturaBriefing(dados()));
  });

  it("não depende da ordem em que o banco devolveu as linhas", () => {
    const d = dados();
    const embaralhado = dados({
      profissionaisPendentes: [...d.profissionaisPendentes].reverse(),
      processosParados: [...d.processosParados].reverse(),
    });
    expect(assinaturaBriefing(embaralhado)).toBe(assinaturaBriefing(d));
  });

  // O admin abrindo a tela registra acesso. Se isso mudasse a assinatura, o
  // texto seria refeito a cada abertura.
  it("ignora acessos ao painel", () => {
    const d = dados();
    const outro = dados({
      movimento: {
        ...d.movimento,
        acessos: { cliente: 9, profissional: 9, admin: 9 },
        pessoasQueEntraram: 20,
      },
    });
    expect(assinaturaBriefing(outro)).toBe(assinaturaBriefing(d));
  });

  // Chat ativo não pode virar uma chamada de IA a cada 15 min.
  it("ignora mensagens trocadas", () => {
    const d = dados();
    const outro = dados({ movimento: { ...d.movimento, mensagensTrocadas: 500 } });
    expect(assinaturaBriefing(outro)).toBe(assinaturaBriefing(d));
  });

  it("ignora o tempo passando sobre o mesmo processo parado", () => {
    const d = dados();
    const outro = dados({
      processosParados: d.processosParados.map((p) => ({
        ...p,
        clienteUltimoAcesso: "2026-09-24T09:00:00Z",
      })),
    });
    expect(assinaturaBriefing(outro)).toBe(assinaturaBriefing(d));
  });

  const base = dados();
  const mudancas: [string, DadosGerenciais][] = [
    [
      "admin novo",
      dados({
        movimento: { ...base.movimento, contasNovas: { cliente: 2, profissional: 1, admin: 1 } },
      }),
    ],
    [
      "cliente novo",
      dados({
        movimento: { ...base.movimento, contasNovas: { cliente: 3, profissional: 1, admin: 0 } },
      }),
    ],
    ["processo novo", dados({ movimento: { ...base.movimento, processosNovos: 2 } })],
    ["documento novo", dados({ movimento: { ...base.movimento, documentosEnviados: 5 } })],
    ["etapa concluída", dados({ movimento: { ...base.movimento, etapasConcluidas: 3 } })],
    ["lead recebido", dados({ movimento: { ...base.movimento, leadsNovos: 4 } })],
    [
      "lead sem resposta a mais",
      dados({
        leadsSemResposta: [
          ...base.leadsSemResposta,
          { cidade: null, uf: null, desde: "2026-09-24T08:00:00Z" },
        ],
      }),
    ],
    [
      "profissional liberado",
      dados({ profissionaisPendentes: base.profissionaisPendentes.slice(1) }),
    ],
    ["aprovação resolvida", dados({ aprovacoesPendentes: [] })],
    ["processo destravou", dados({ processosParados: base.processosParados.slice(1) })],
    [
      "documento pendente a menos",
      dados({
        processosParados: base.processosParados.map((p) => ({ ...p, documentosPendentes: 0 })),
      }),
    ],
    ["profissional voltou", dados({ profissionaisInativos: [] })],
  ];

  it.each(mudancas)("muda quando há %s", (_nome, mudado) => {
    expect(assinaturaBriefing(mudado)).not.toBe(assinaturaBriefing(base));
  });
});

describe("assinatura ao longo do dia", () => {
  // Eventos espalhados pelos últimos 10 dias, incluindo alguns bem na borda
  // da janela. Nada novo acontece durante o dia 24.
  const eventos = [
    "2026-09-14T10:00:00Z",
    "2026-09-17T02:59:00Z", // 23h59 de 16/09 em SP: fora da janela
    "2026-09-17T03:00:00Z", // meia-noite de 17/09 em SP: dentro
    "2026-09-17T15:00:00Z", // seria expulso pela janela móvel às 12h de 24/09
    "2026-09-20T12:00:00Z",
    "2026-09-23T22:00:00Z",
  ];

  /** Coleta como o servidor faz: conta o que é >= início da janela. */
  function coletar(agora: Date): DadosGerenciais {
    const desde = inicioDaJanela(agora, 7);
    const n = eventos.filter((e) => new Date(e) >= new Date(desde)).length;
    const d = dados();
    return {
      ...d,
      movimento: { ...d.movimento, documentosEnviados: n, processosNovos: n, leadsNovos: n },
    };
  }

  it("não muda do começo ao fim do dia sem dado novo", () => {
    const horas = [
      "2026-09-24T03:00:00Z", // 00h em SP
      "2026-09-24T12:00:00Z",
      "2026-09-24T15:30:00Z",
      "2026-09-24T21:00:00Z",
      "2026-09-25T02:59:00Z", // 23h59 em SP
    ];
    const assinaturas = new Set(horas.map((h) => assinaturaBriefing(coletar(new Date(h)))));
    expect(assinaturas.size).toBe(1);
  });

  it("só anda na virada do dia de São Paulo", () => {
    const fimDoDia = assinaturaBriefing(coletar(new Date("2026-09-25T02:59:00Z")));
    const diaSeguinte = assinaturaBriefing(coletar(new Date("2026-09-25T03:00:00Z")));
    expect(diaSeguinte).not.toBe(fimDoDia);
  });
});

describe("decidirBriefing", () => {
  const AGORA = new Date("2026-09-24T15:00:00Z");
  const haMinutos = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();

  it("usa o guardado quando a assinatura é a mesma, por mais velho que seja", () => {
    expect(
      decidirBriefing({
        forcar: false,
        guardado: { assinatura: "abc", gerado_em: haMinutos(300) },
        assinaturaAtual: "abc",
        agora: AGORA,
      }),
    ).toBe("usar-guardado");
  });

  it("usa o guardado quando mudou, mas faz menos de 15 minutos", () => {
    expect(
      decidirBriefing({
        forcar: false,
        guardado: { assinatura: "abc", gerado_em: haMinutos(14) },
        assinaturaAtual: "xyz",
        agora: AGORA,
      }),
    ).toBe("usar-guardado");
  });

  it("gera quando mudou e já passaram 15 minutos", () => {
    expect(
      decidirBriefing({
        forcar: false,
        guardado: {
          assinatura: "abc",
          gerado_em: new Date(AGORA.getTime() - INTERVALO_MINIMO_MS).toISOString(),
        },
        assinaturaAtual: "xyz",
        agora: AGORA,
      }),
    ).toBe("gerar");
  });

  it("gera quando não há texto do dia", () => {
    expect(
      decidirBriefing({ forcar: false, guardado: null, assinaturaAtual: "xyz", agora: AGORA }),
    ).toBe("gerar");
  });

  it("gera no botão Atualizar, mesmo com assinatura igual e texto recente", () => {
    expect(
      decidirBriefing({
        forcar: true,
        guardado: { assinatura: "abc", gerado_em: haMinutos(1) },
        assinaturaAtual: "abc",
        agora: AGORA,
      }),
    ).toBe("gerar");
  });

  it("trata texto de antes da coluna (assinatura nula) como diferente", () => {
    expect(
      decidirBriefing({
        forcar: false,
        guardado: { assinatura: null, gerado_em: haMinutos(60) },
        assinaturaAtual: "abc",
        agora: AGORA,
      }),
    ).toBe("gerar");
  });
});
