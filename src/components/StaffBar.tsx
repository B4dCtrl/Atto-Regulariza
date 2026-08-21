import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CONSTRUCTION_MODE, DEV_STORAGE_KEY } from "@/lib/site-config";

/**
 * Barra flutuante de navegação rápida entre as áreas do produto.
 * Visível quando:
 *  - o usuário logado é ADMIN (ferramenta de teste/decisão), ou
 *  - "modo equipe" durante a fase de construção (navegador desbloqueado).
 */
export function StaffBar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamMode, setTeamMode] = useState(false);

  useEffect(() => {
    // Modo equipe (legado da fase de construção)
    if (CONSTRUCTION_MODE) {
      try { setTeamMode(localStorage.getItem(DEV_STORAGE_KEY) === "1"); } catch { /* noop */ }
    }

    // Verifica se o usuário logado é admin
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsAdmin(false); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    }
    checkAdmin();

    const { data: sub } = supabase.auth.onAuthStateChange(() => { checkAdmin(); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const show = isAdmin || teamMode;
  if (!show) return null;

  async function sair() {
    if (isAdmin) {
      await supabase.auth.signOut();
    } else {
      try { localStorage.removeItem(DEV_STORAGE_KEY); } catch { /* noop */ }
    }
    window.location.href = "/entrar";
  }

  const linkCls =
    "rounded-full px-3 py-1 text-ink-soft transition-colors hover:bg-surface hover:text-foreground";

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-background/90 px-2 py-1.5 text-xs shadow-[0_8px_30px_-8px_oklch(0.16_0.01_60_/_0.35)] backdrop-blur-xl">
        <span className="flex items-center gap-1.5 px-2 font-medium text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {isAdmin ? "Admin" : "Modo equipe"}
        </span>
        {/* Só dois destinos.
            "Preços" era uma página do site, alcançável por "Site". "Gestão"
            apontava para /gestao, que redireciona para /admin — o mesmo link
            duas vezes. "Painel cliente" e "Profissional" abriam as telas com o
            usuário admin, que não tem imóvel nem processo atribuído: mostravam
            estado vazio e davam a impressão de tela quebrada. Para ver essas
            telas COM dados existem as contas de teste. */}
        <Link to="/" className={linkCls}>Site</Link>
        <Link to="/admin" className={linkCls}>Back office</Link>
        <button
          onClick={sair}
          className="rounded-full px-3 py-1 text-red-500 transition-colors hover:bg-red-50"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
