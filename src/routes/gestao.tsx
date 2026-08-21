import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota antiga da "Gestão Geral", hoje só um redirecionamento.
 *
 * A tela foi absorvida por /admin. O arquivo continua existindo para não
 * quebrar link salvo ou favorito de quem usava o endereço antigo.
 *
 * Havia 300 linhas de componente abaixo deste redirect — inalcançáveis, porque
 * `beforeLoad` lança antes de qualquer renderização. Removidas.
 */
export const Route = createFileRoute("/gestao")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Gestão Geral — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
