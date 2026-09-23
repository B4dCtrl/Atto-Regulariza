import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Endereço curto da caixa de e-mail. Só redireciona: a tela mora dentro do
 * admin, que já barra quem não é admin.
 */
export const Route = createFileRoute("/mail")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/mail" });
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
});
