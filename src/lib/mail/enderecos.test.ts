import { describe, it, expect } from "vitest";
import { descobrirAlias, ehEndereco } from "./enderecos";

describe("descobrirAlias", () => {
  it("acha o alias no To", () => {
    expect(descobrirAlias({ to: ["tais@atoregulariza.com.br"] })).toBe("tais@atoregulariza.com.br");
  });

  it("ignora maiúsculas", () => {
    expect(descobrirAlias({ to: ["Lauro@AtoRegulariza.com.br"] })).toBe(
      "lauro@atoregulariza.com.br",
    );
  });

  it("acha no Cc quando o To é de fora", () => {
    expect(
      descobrirAlias({ to: ["cliente@gmail.com"], cc: ["suporte@atoregulariza.com.br"] }),
    ).toBe("suporte@atoregulariza.com.br");
  });

  it("usa Delivered-To quando veio em cópia oculta", () => {
    expect(
      descobrirAlias({ to: ["lista@x.com"], deliveredTo: ["gabriel@atoregulariza.com.br"] }),
    ).toBe("gabriel@atoregulariza.com.br");
  });

  it("prefere alias pessoal a contato@ quando os dois aparecem", () => {
    expect(
      descobrirAlias({
        to: ["contato@atoregulariza.com.br", "tais@atoregulariza.com.br"],
      }),
    ).toBe("tais@atoregulariza.com.br");
  });

  it("sem alias conhecido, contato@", () => {
    expect(descobrirAlias({ to: ["outro@x.com"] })).toBe("contato@atoregulariza.com.br");
    expect(descobrirAlias({})).toBe("contato@atoregulariza.com.br");
  });
});

describe("ehEndereco", () => {
  it("aceita só os cinco", () => {
    expect(ehEndereco("suporte@atoregulariza.com.br")).toBe(true);
    expect(ehEndereco("hacker@atoregulariza.com.br")).toBe(false);
  });
});
