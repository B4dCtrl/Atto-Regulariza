/**
 * `/painel` — a porta de entrada de quem já está logado.
 *
 * Existe para a logo ter um destino só. Antes ela apontava para "/" em todas
 * as telas internas, e quem estava logado caía na página de vendas do produto
 * que já usa — com "Falar com Especialista" como se fosse um visitante novo.
 *
 * A alternativa seria cada tela decidir o destino, o que significa repetir a
 * regra de papel em cada cabeçalho e errar em um deles algum dia. Aqui a regra
 * vive uma vez: quem tem sessão vai para o painel do seu papel, quem não tem
 * vai para a home.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { resolveLandingPath } from "@/lib/auth-routing";

export const Route = createFileRoute("/painel")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Sem sessão a home é o lugar certo: é para lá que a logo levaria de
    // qualquer forma, e ninguém vê tela de login por clicar numa logo.
    if (!session) throw redirect({ to: "/" });

    throw redirect({ to: await resolveLandingPath(session.user.id) });
  },
});
