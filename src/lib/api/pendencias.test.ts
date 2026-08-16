import { describe, it, expect } from "vitest";
import { textoDaPendencia } from "./pendencias";
import type { Tables } from "@/integrations/supabase/types";

function pend(over: Partial<Tables<"pendencies">> = {}): Tables<"pendencies"> {
  return {
    id: "1",
    property_id: "p1",
    stage_number: 1,
    descricao: "Envie o IPTU atualizado",
    kind: null,
    status: "aberta",
    criada_por: null,
    criada_em: "2026-08-16T10:00:00Z",
    resolvida_em: null,
    resolvida_por: null,
    ...over,
  };
}

describe("textoDaPendencia", () => {
  it("usa a descrição escrita pela equipe", () => {
    expect(textoDaPendencia(pend())).toBe("Envie o IPTU atualizado");
  });

  it("cai para um pedido genérico quando a descrição vem vazia", () => {
    expect(textoDaPendencia(pend({ descricao: "   " }))).toBe(
      "A equipe precisa de um documento seu",
    );
  });

  it("usa o rótulo do tipo quando há kind e a descrição está vazia", () => {
    expect(textoDaPendencia(pend({ descricao: "", kind: "iptu" }))).toBe("Envie: IPTU atualizado");
  });

  it("não inventa rótulo para kind desconhecido", () => {
    expect(textoDaPendencia(pend({ descricao: "", kind: "inexistente" }))).toBe("Envie: Documento");
  });
});
