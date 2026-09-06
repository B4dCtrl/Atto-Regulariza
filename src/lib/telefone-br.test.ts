import { describe, it, expect } from "vitest";
import { formaAlternativa } from "./telefone-br";

describe("formaAlternativa", () => {
  it("celular sem o 9 ganha o 9", () => {
    expect(formaAlternativa("554184471404")).toBe("5541984471404");
  });

  it("celular com o 9 perde o 9", () => {
    expect(formaAlternativa("5541984471404")).toBe("554184471404");
  });

  it("vale para qualquer DDD", () => {
    expect(formaAlternativa("556798513179")).toBe("5567998513179");
    expect(formaAlternativa("5511987654321")).toBe("551187654321");
  });

  it("fixo não tem outra forma — o 9 só existe em celular", () => {
    // 5541 3333-4444: começa com 3, é fixo.
    expect(formaAlternativa("554133334444")).toBeNull();
  });

  it("número de outro país fica como está", () => {
    expect(formaAlternativa("15552019667")).toBeNull();
    expect(formaAlternativa("351912345678")).toBeNull();
  });

  it("tamanho fora do padrão brasileiro não é mexido", () => {
    expect(formaAlternativa("55418447")).toBeNull();
    expect(formaAlternativa("5541984471404999")).toBeNull();
    expect(formaAlternativa("")).toBeNull();
  });

  it("com o 9 duplicado ainda resolve para a forma curta", () => {
    // 55 41 9 9847-1404 — celular novo, com 9 na frente do 8 dígitos.
    expect(formaAlternativa("5541998471404")).toBe("554198471404");
  });
});
