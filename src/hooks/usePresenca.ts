/**
 * Diz ao servidor que esta pessoa está com o painel aberto agora.
 *
 * Existe para o chat saber se vale esperar o humano. Antes a assistente
 * respondia sempre que ninguém da equipe tivesse falado em 15 minutos, o que
 * atropelava o profissional que estava ali, digitando a resposta.
 *
 * Bate a cada 30 s, e o servidor considera online quem bateu no último minuto
 * — a folga cobre um atraso de rede sem fazer quem está presente parecer
 * ausente.
 *
 * Para de bater quando a aba sai de vista: celular com o app em segundo plano
 * é exatamente o caso de "não está olhando", e mantê-lo como online deixaria o
 * cliente esperando por alguém que não vai responder. Volta a bater ao
 * reaparecer, imediatamente, para não haver um buraco de 30 s.
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const INTERVALO = 30_000;

export function usePresenca(ativo = true) {
  useEffect(() => {
    if (!ativo) return;

    let vivo = true;

    const bater = () => {
      if (!vivo || document.visibilityState !== "visible") return;
      // Sem await e sem tratar erro: é telemetria de presença. Se uma batida
      // falhar, a próxima vem em 30 s; derrubar a tela por isso seria pior.
      void supabase.rpc("registrar_presenca");
    };

    bater();
    const timer = setInterval(bater, INTERVALO);
    document.addEventListener("visibilitychange", bater);

    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", bater);
    };
  }, [ativo]);
}
