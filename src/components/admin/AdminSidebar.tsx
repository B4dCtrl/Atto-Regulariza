import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FolderOpen,
  Settings,
  LogOut,
  DollarSign,
  UserPlus,
  UserCheck,
  ChevronDown,
  Inbox,
  Library,
  GraduationCap,
  ShieldCheck,
  Flag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const mainItems = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/leads", label: "Leads", icon: Inbox },
  { to: "/admin/processos", label: "Processos", icon: Briefcase },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/documentos", label: "Documentos", icon: FolderOpen },
] as const;

const cadastroItems = [
  { to: "/admin/aprovacoes", label: "Aprovações", icon: ShieldCheck },
  { to: "/admin/aprovacoes-processo", label: "Aprov. processo", icon: Flag },
  { to: "/admin/cadastro-profissional", label: "Profissional", icon: UserPlus },
  { to: "/admin/cadastro-cliente", label: "Cliente", icon: UserCheck },
] as const;

const bibliotecaItems = [
  { to: "/admin/documentos-padrao", label: "Docs Padrão", icon: Library },
  { to: "/admin/cursos", label: "Cursos", icon: GraduationCap },
] as const;

const financeiroItems = [
  { to: "/admin/financeiro", label: "Precificação", icon: DollarSign },
] as const;

export function AdminSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [cadastroOpen, setCadastroOpen] = useState(true);
  const [pendentes, setPendentes] = useState(0);

  // Contador de profissionais aguardando aprovação — o admin precisa notar sem procurar.
  useEffect(() => {
    let ativo = true;
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "profissional")
      .eq("approval_status", "pendente")
      .then(({ count }) => {
        if (ativo) setPendentes(count ?? 0);
      });
    return () => {
      ativo = false;
    };
  }, [path]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  };

  const NavLink = ({
    to,
    label,
    icon: Icon,
    exact,
  }: {
    to: string;
    label: string;
    icon: React.ElementType;
    exact?: boolean;
  }) => {
    const active = isActive(to, exact);
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          active ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {label}
        </span>
        {to === "/admin/aprovacoes" && pendentes > 0 && (
          <span
            title={`${pendentes} aguardando aprovação`}
            className={`ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[10px] font-medium ${
              active ? "bg-background text-foreground" : "bg-accent text-accent-foreground"
            }`}
          >
            {pendentes}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="group sticky top-0 h-screen w-16 shrink-0">
      <div
        className="absolute inset-y-0 left-0 z-20 flex h-full w-16 flex-col overflow-hidden border-r border-border
                   bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                   group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]"
      >
        {/* Logo */}
        <Link to="/admin" className="flex items-center gap-2 px-1.5 py-3">
          <img
            src="/ato-icon.png"
            alt="Ato Regulariza"
            className="h-8 w-8 shrink-0 object-contain group-hover:hidden"
          />
          <div className="hidden overflow-hidden group-hover:block">
            <img
              src="/ato-wordmark.png"
              alt="Ato Regulariza"
              className="h-5 w-auto object-contain"
            />
            <div className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-widest text-ink-soft">
              Gestão
            </div>
          </div>
        </Link>

        {/* Main nav */}
        <nav className="mt-4 space-y-1">
          {mainItems.map((it) => (
            <NavLink key={it.to} {...it} />
          ))}
        </nav>

        {/* Cadastros */}
        <div className="mt-5">
          <button
            onClick={() => setCadastroOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-3 pb-1 text-[10px] uppercase tracking-widest text-ink-soft opacity-0 transition-opacity group-hover:opacity-100"
          >
            Cadastros
            <ChevronDown
              className={`ml-auto h-3 w-3 transition-transform ${cadastroOpen ? "rotate-180" : ""}`}
            />
          </button>
          {/* Icon-only fallback when sidebar collapsed */}
          <div className="mt-1 space-y-1 group-hover:hidden">
            {cadastroItems.map((it) => (
              <NavLink key={it.to} {...it} />
            ))}
          </div>
          {/* Expanded list */}
          <div
            className={`hidden mt-1 space-y-1 group-hover:block ${!cadastroOpen ? "group-hover:!hidden" : ""}`}
          >
            {cadastroItems.map((it) => (
              <NavLink key={it.to} {...it} />
            ))}
          </div>
        </div>

        {/* Biblioteca */}
        <div className="mt-5">
          <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
            Biblioteca
          </div>
          <div className="mt-1 space-y-1">
            {bibliotecaItems.map((it) => (
              <NavLink key={it.to} {...it} />
            ))}
          </div>
        </div>

        {/* Financeiro */}
        <div className="mt-5">
          <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
            Financeiro
          </div>
          <div className="mt-1 space-y-1">
            {financeiroItems.map((it) => (
              <NavLink key={it.to} {...it} />
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-auto space-y-2">
          <Link
            to="/perfil-profissional"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-surface"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Configurações
            </span>
          </Link>
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
