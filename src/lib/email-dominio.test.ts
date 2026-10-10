import { describe, expect, it } from "vitest";
import { avisoDominioInexistente, dominioDoEmail } from "./email-dominio";

describe("dominioDoEmail", () => {
  it("extrai e normaliza", () => {
    expect(dominioDoEmail(" Maria@Gmail.COM ")).toBe("gmail.com");
  });

  it("aceita subdomínio", () => {
    expect(dominioDoEmail("lauro@mail.atoregulariza.com.br")).toBe("mail.atoregulariza.com.br");
  });

  it("recusa o que não é e-mail", () => {
    expect(dominioDoEmail("maria")).toBeNull();
    expect(dominioDoEmail("@gmail.com")).toBeNull();
    expect(dominioDoEmail("maria@gmail")).toBeNull();
    expect(dominioDoEmail("maria@gmail..com")).toBeNull();
  });
});

describe("avisoDominioInexistente", () => {
  it("cita o domínio digitado", () => {
    expect(avisoDominioInexistente("ato.com")).toContain("@ato.com");
  });
});
