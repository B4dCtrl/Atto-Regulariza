import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Users, FolderOpen, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/processos", label: "Processos", icon: Briefcase },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/documentos", label: "Documentos", icon: FolderOpen },
] as const;

export function AdminSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  };

  return (
    // Gutter fixo (w-16); o painel interno expande no hover sobre o conteúdo
    <aside className="group sticky top-0 h-screen w-16 shrink-0">
      <div
        className="absolute inset-y-0 left-0 z-20 flex h-full w-16 flex-col overflow-hidden border-r border-border
                   bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                   group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]"
      >
        <Link to="/admin" className="flex items-center gap-2 px-1.5 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-foreground text-background">
            <span className="font-serif text-lg leading-none">R</span>
          </div>
          <div className="overflow-hidden opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="whitespace-nowrap font-serif text-lg leading-none tracking-tight">Regulariza</div>
            <div className="mt-0.5 whitespace-nowrap text-[10px] uppercase tracking-widest text-ink-soft">
              Back office
            </div>
          </div>
        </Link>

        <nav className="mt-4 space-y-1">
          {items.map((it) => {
            const active = isActive(it.to, "exact" in it ? it.exact : false);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"
                }`}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {it.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-surface">
            <Settings className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Configurações
            </span>
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-surface"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Sair
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
