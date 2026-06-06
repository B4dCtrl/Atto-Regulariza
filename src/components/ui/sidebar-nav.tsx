import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, FolderOpen, FileText,
  MessageSquare, Kanban, BarChart2, Building2,
  Settings, LogOut, Home, Bell, Upload, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LiquidGlassSurface } from "@/components/ui/liquid-glass-surface";

const SECTIONS = [
  {
    label: "Principal",
    items: [
      { icon: Home,            label: "Início",        to: "/"                as const },
      { icon: LayoutDashboard, label: "Dashboard",     to: "/dashboard"       as const },
    ],
  },
  {
    label: "Back-office",
    items: [
      { icon: Users,           label: "Leads",         to: "/admin/clientes"  as const },
      { icon: FolderOpen,      label: "Processos",     to: "/admin/processos" as const },
      { icon: FileText,        label: "Documentos",    to: "/dashboard"       as const },
      { icon: MessageSquare,   label: "Mensagens",     to: "/dashboard"       as const },
      { icon: Kanban,          label: "Kanban",        to: "/admin"           as const },
      { icon: Upload,          label: "Envios",        to: "/dashboard"       as const },
      { icon: BarChart2,       label: "Relatórios",    to: "/admin"           as const },
    ],
  },
  {
    label: "Empresa",
    items: [
      { icon: Building2,       label: "Clientes",      to: "/admin/clientes"  as const },
      { icon: Bell,            label: "Notificações",  to: "/admin"           as const },
      { icon: Settings,        label: "Configurações", to: "/admin"           as const },
    ],
  },
];

export function SidebarNav() {
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    try { await supabase.auth.signOut(); } catch { /* silencioso */ }
    window.location.href = "/";
  }

  return (
    <div
      className="fixed left-0 top-1/2 z-50 -translate-y-1/2"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Aba indicadora quando fechado */}
      <div
        className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-12 w-1.5
                    rounded-r-full bg-accent/50 transition-opacity duration-300
                    ${open ? "opacity-0" : "opacity-100"}`}
      />

      {/* Painel com vidro líquido real */}
      <LiquidGlassSurface
        glassColor="oklch(from var(--background) l c h / 8%)"
        blur={2.5}
        saturate={170}
        className={`overflow-hidden rounded-r-2xl
                    transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                    ${open ? "w-52" : "w-[52px]"}`}
        contentClassName="flex flex-col py-3"
      >
        {/* Linha de acento esquerda */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-accent/35 to-transparent" />

        {SECTIONS.map((section, si) => (
          <div key={si}>
            <div className={`px-3 pb-0.5 pt-2 transition-opacity duration-150 ${open ? "opacity-100" : "opacity-0"}`}>
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-ink-soft/60">
                {section.label}
              </span>
            </div>

            <nav className="space-y-0.5 px-1.5">
              {section.items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  data-cursor="expand"
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-ink-soft
                             transition-colors hover:bg-accent/10 hover:text-accent"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span
                    className={`overflow-hidden whitespace-nowrap font-medium transition-all duration-200
                                ${open ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"}`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            {si < SECTIONS.length - 1 && (
              <div className="mx-3 my-1.5 border-t border-border/50" />
            )}
          </div>
        ))}

        {/* Logout */}
        <div className="mx-1.5 mt-1 border-t border-border/50 pt-1">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm
                       text-ink-soft transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap font-medium transition-all duration-200
                          ${open ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"}`}
            >
              Sair
            </span>
          </button>
        </div>

        {/* Ícone expand/collapse */}
        <div className="flex justify-center pt-1">
          <ChevronRight
            className={`h-3.5 w-3.5 text-ink-soft/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </LiquidGlassSurface>
    </div>
  );
}
