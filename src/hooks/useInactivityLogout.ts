import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Desloga o usuário após um período de inatividade.
 *
 * Regras:
 * - A sessão persiste no navegador (localStorage) — fechar a aba NÃO desloga na hora.
 * - Qualquer interação (mouse, teclado, toque, scroll) reinicia o contador.
 * - Após `timeoutMs` sem interação, faz signOut e leva para /entrar.
 * - O último instante de atividade é gravado no localStorage, então reabrir a aba
 *   depois do tempo expirado também desloga (inatividade conta com a aba fechada).
 *
 * Montado uma única vez no root, cobre todas as páginas autenticadas.
 */
export function useInactivityLogout(timeoutMs = 10 * 60 * 1000) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const LAST_KEY = "regulariza_last_activity";
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    let active = true;
    let hasSession = false;
    let lastActivity = Date.now();

    const onActivity = () => { lastActivity = Date.now(); };

    function startTracking() {
      lastActivity = Date.now();
      try { localStorage.setItem(LAST_KEY, String(lastActivity)); } catch { /* ignore */ }
      events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    }

    function stopTracking() {
      events.forEach((e) => window.removeEventListener(e, onActivity));
    }

    async function doLogout() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.auth.signOut();
      try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
      window.location.href = "/entrar";
    }

    // Estado inicial: já existe sessão?
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      hasSession = !!session;
      if (!hasSession) return;

      // Inatividade acumulada com a aba fechada já estourou o limite?
      const stored = Number(localStorage.getItem(LAST_KEY) || 0);
      if (stored && Date.now() - stored > timeoutMs) {
        doLogout();
        return;
      }
      startTracking();
    });

    // Login/logout durante a navegação (sem reload) ativa/desativa o rastreio.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nowHas = !!session;
      if (nowHas && !hasSession) startTracking();
      if (!nowHas && hasSession) stopTracking();
      hasSession = nowHas;
    });

    // Verificação periódica — grava a atividade e desloga se passou do limite.
    const interval = setInterval(() => {
      if (!hasSession) return;
      try { localStorage.setItem(LAST_KEY, String(lastActivity)); } catch { /* ignore */ }
      if (Date.now() - lastActivity > timeoutMs) doLogout();
    }, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
      stopTracking();
      sub.subscription.unsubscribe();
    };
  }, [timeoutMs]);
}
