import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CONSTRUCTION_MODE, DEV_STORAGE_KEY } from "@/lib/site-config";

/**
 * Barra flutuante visível apenas em "modo equipe" (navegador desbloqueado
 * durante a fase de construção). Atalhos para navegar o site por dentro,
 * inclusive o back office, sem precisar de login (LOGIN_PAUSED).
 */
export function StaffBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!CONSTRUCTION_MODE) return;
    try {
      setShow(localStorage.getItem(DEV_STORAGE_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);

  if (!show) return null;

  function sair() {
    try {
      localStorage.removeItem(DEV_STORAGE_KEY);
    } catch {
      /* noop */
    }
    window.location.href = "/";
  }

  const linkCls =
    "rounded-full px-3 py-1 text-ink-soft transition-colors hover:bg-surface hover:text-foreground";

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-background/90 px-2 py-1.5 text-xs shadow-[0_8px_30px_-8px_oklch(0.16_0.01_60_/_0.35)] backdrop-blur-xl">
        <span className="flex items-center gap-1.5 px-2 font-medium text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Modo equipe
        </span>
        <Link to="/" className={linkCls}>Site</Link>
        <Link to="/precos" className={linkCls}>Preços</Link>
        <Link to="/dashboard" className={linkCls}>Painel cliente</Link>
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
