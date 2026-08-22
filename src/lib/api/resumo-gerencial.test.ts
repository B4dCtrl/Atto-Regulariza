import { describe, it, expect } from "vitest";
import { montarResumo, diasDesde, type DadosGerenciais } from "./resumo-gerencial";

const AGORA = new Date("2026-08-22T12:00:00Z");

function dados(over: Partial<DadosGerenciais> = {}): DadosGerenciais {
  return {
    profissionaisPendentes: [],
    aprovacoesPendentes: [],
    processosParados: [],
    leadsSemResposta: [],
    profissionaisInativos: [],
    movimento: {
      contasNovas: { cliente: 0, profissional: 0 },
      acessos: { cliente: 0, profissional: 0, admin: 0 },
      pessoasQueEntraram: 0,
      leadsNovos: 0,
      processosNovos: 0,
      documentosEnviados: 0,
      mensagensTrocadas: 0,
      etapasConcluidas: 0,
    },
    ...over,
  };
}

describe("diasDesde", () => {
  it("conta os dias inteiros passados", () => {
    expect(diasDesde("2026-08-10T12:00:00Z", AGORA)).toBe(12);
  });

  it("devolve 0 para hoje", () => {
    expect(diasDesde("2026-08-22T08:00:00Z", AGORA)).toBe(0);
  });

  it("devolve null quando nunca aconteceu", () => {
    expect(diasDesde(null, AGORA)).toBeNull();
  });
});

describe("montarResumo", () => {
  it("diz que não há nada quando tudo está vazio", () => {
    expect(montarResumo(dados(), AGORA)).toContain("Nada pendente");
  });

  it("declara o silêncio em vez de omitir o movimento", () => {
    // Sem esta linha a IA não distingue "não houve movimento" de "o resumo
    // esqueceu de contar" — e a segunda hipótese vira invenção.
    expect(montarResumo(dados(), AGORA)).toContain("Movimento dos últimos 7 dias: nenhum");
  });

  it("relata contas novas, acessos e leads do período", () => {
    const texto = montarResumo(
      dados({
        movimento: {
          contasNovas: { cliente: 3, profissional: 1 },
          acessos: { cliente: 12, profissional: 4, admin: 9 },
          pessoasQueEntraram: 6,
          leadsNovos: 5,
          processosNovos: 2,
          documentosEnviados: 7,
          mensagensTrocadas: 21,
          etapasConcluidas: 4,
        },
      }),
      AGORA,
    );
    expect(texto).toContain("Contas novas: 4");
    expect(texto).toContain("Acessos ao painel: 25 de 6 pessoa(s)");
    expect(texto).toContain("Leads recebidos: 5");
    expect(texto).toContain("Processos abertos: 2");
    expect(texto).toContain("Documentos enviados: 7");
    expect(texto).toContain("Mensagens trocadas: 21");
    expect(texto).toContain("Etapas concluídas: 4");
  });

  it("omite as linhas do que não teve movimento", () => {
    const texto = montarResumo(
      dados({
        movimento: {
          contasNovas: { cliente: 0, profissional: 0 },
          acessos: { cliente: 0, profissional: 0, admin: 0 },
          pessoasQueEntraram: 0,
          leadsNovos: 2,
          processosNovos: 0,
          documentosEnviados: 0,
          mensagensTrocadas: 0,
          etapasConcluidas: 0,
        },
      }),
      AGORA,
    );
    expect(texto).toContain("Leads recebidos: 2");
    expect(texto).not.toContain("Contas novas");
    expect(texto).not.toContain("Mensagens trocadas");
  });

  it("lista profissional aguardando liberação com a espera em dias", () => {
    const texto = montarResumo(
      dados({
        profissionaisPendentes: [{ nome: "João Souza", desde: "2026-08-19T12:00:00Z" }],
      }),
      AGORA,
    );
    expect(texto).toContain("João Souza");
    expect(texto).toContain("3 dias");
  });

  it("mostra processo parado com etapa, dias e cliente", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 3,
            paradoDesde: "2026-08-10T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: "2026-08-13T12:00:00Z",
            documentosPendentes: 2,
          },
        ],
      }),
      AGORA,
    );
    expect(texto).toContain("Casa Teste 1");
    expect(texto).toContain("etapa 3");
    expect(texto).toContain("12 dias");
    expect(texto).toContain("Maria Silva");
    expect(texto).toContain("9 dias");
  });

  it("diz explicitamente quando o cliente nunca acessou", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 1,
            paradoDesde: "2026-08-20T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: null,
            documentosPendentes: 1,
          },
        ],
      }),
      AGORA,
    );
    expect(texto).toContain("nunca acessou");
  });

  // Esta é a razão de o módulo existir separado: garantir que nenhum dado
  // sensível vá para um terceiro, mesmo que alguém acrescente campo no futuro.
  it("nao deixa escapar CPF, e-mail, telefone ou matricula", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 2,
            paradoDesde: "2026-08-15T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: null,
            documentosPendentes: 0,
          },
        ],
        leadsSemResposta: [{ cidade: "Curitiba", uf: "PR", desde: "2026-08-17T12:00:00Z" }],
      }),
      AGORA,
    );
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/); // CPF
    expect(texto).not.toMatch(/@/); // e-mail
    expect(texto).not.toMatch(/\(\d{2}\)\s?\d/); // telefone
    expect(texto.toLowerCase()).not.toContain("matrícula");
  });

  it("encurta o id do processo para caber no texto", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 2,
            paradoDesde: "2026-08-15T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: null,
            documentosPendentes: 0,
          },
        ],
      }),
      AGORA,
    );
    expect(texto).toContain("#A3F00000");
    expect(texto).not.toContain("a3f00000-0000-0000-0000-000000000000");
  });
});
