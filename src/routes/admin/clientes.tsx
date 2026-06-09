import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  UserPlus, Search, Phone, Mail, Building2,
  Home, Trash2, ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Gestão Regulariza" }] }),
  component: ClientesPage,
});

const TIPO_LABEL: Record<string, string> = {
  casa:       "Casa",
  apartamento:"Apartamento",
  terreno:    "Terreno",
  comercial:  "Sala comercial",
  galpao:     "Galpão",
};

const SITUACAO_LABEL: Record<string, string> = {
  sem_escritura:  "Sem escritura",
  matricula:      "Matrícula com pendências",
  sem_habite:     "Sem habite-se",
  retificacao:    "Retificação de área",
  heranca:        "Herança/Inventário",
  usucapiao:      "Usucapião",
  outro:          "Outro",
};

interface Client {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  tipo_imovel: string;
  situacao: string;
  objetivo: string;
  cidade: string;
  estado: string;
  cadastrado_em: string;
  tutorial_concluido: boolean;
}

const STORAGE_KEY = "regulariza-clientes";

function loadClients(): Client[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function ClientesPage() {
  const [clients,  setClients]  = useState<Client[]>([]);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    setClients(loadClients());
    const handler = () => setClients(loadClients());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Poll localStorage (same-tab updates)
  useEffect(() => {
    const iv = setInterval(() => setClients(loadClients()), 800);
    return () => clearInterval(iv);
  }, []);

  const remove = (id: string) => {
    if (!confirm("Remover este cliente?")) return;
    const updated = clients.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setClients(updated);
    if (selected?.id === id) setSelected(null);
  };

  const filtered = clients.filter((c) => {
    const okFilter = filter === "all" || c.tipo_imovel === filter || c.situacao === filter;
    const q = search.toLowerCase();
    return okFilter && (!q || c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão</div>
          <h1 className="font-serif text-3xl tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-ink-soft">{clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/admin/cadastro-cliente"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" /> Novo cliente
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
          <Search className="h-3.5 w-3.5 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, cidade…"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-ink-soft/60"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm text-ink-soft outline-none cursor-pointer"
        >
          <option value="all">Todos</option>
          <optgroup label="Tipo de imóvel">
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </optgroup>
          <optgroup label="Situação">
            {Object.entries(SITUACAO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </optgroup>
        </select>
        <span className="ml-auto text-xs text-ink-soft">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-3xl bg-background ring-1 ring-border p-16 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-surface">
            <UserPlus className="h-7 w-7 text-ink-soft" />
          </div>
          <h2 className="font-serif text-2xl tracking-tight">Nenhum cliente cadastrado</h2>
          <p className="mt-2 text-sm text-ink-soft">Cadastre seu primeiro cliente para começar.</p>
          <Link
            to="/admin/cadastro-cliente"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background hover:bg-foreground/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar cliente
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Lista */}
          <div className="rounded-3xl bg-background ring-1 ring-border overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_80px] gap-4 border-b border-border px-5 py-3 text-[11px] uppercase tracking-wider text-ink-soft">
              <span>Cliente</span>
              <span>Imóvel</span>
              <span>Situação</span>
              <span></span>
            </div>
            <ul>
              {filtered.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                >
                  <button
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className={`w-full grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_80px] gap-4 items-center border-b border-border/50 px-5 py-4 last:border-0 text-left transition-colors ${selected?.id === c.id ? "bg-foreground text-background" : "hover:bg-surface/40"}`}
                  >
                    {/* Nome */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-medium ${selected?.id === c.id ? "bg-background text-foreground" : "bg-foreground text-background"}`}>
                        {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.nome}</div>
                        <div className={`text-xs truncate ${selected?.id === c.id ? "text-background/60" : "text-ink-soft"}`}>{c.email}</div>
                      </div>
                    </div>
                    {/* Tipo imóvel */}
                    <div className={`text-sm ${selected?.id === c.id ? "text-background/80" : "text-ink-soft"}`}>
                      {TIPO_LABEL[c.tipo_imovel] ?? c.tipo_imovel}
                    </div>
                    {/* Situação */}
                    <div className={`text-sm ${selected?.id === c.id ? "text-background/80" : "text-ink-soft"}`}>
                      {SITUACAO_LABEL[c.situacao] ?? c.situacao}
                    </div>
                    <ChevronRight className={`h-4 w-4 ${selected?.id === c.id ? "text-background/60" : "text-ink-soft"}`} />
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Detalhe lateral */}
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="rounded-3xl bg-background ring-1 ring-border p-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <div className="font-serif text-2xl tracking-tight">{selected.nome}</div>
                    <div className="mt-1 text-xs text-ink-soft">
                      Cadastrado em {new Date(selected.cadastrado_em).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <button onClick={() => remove(selected.id)} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{selected.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{selected.telefone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink-soft">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{selected.cidade} · {selected.estado}</span>
                  </div>
                  <div className="flex items-start gap-2 text-ink-soft">
                    <Home className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{TIPO_LABEL[selected.tipo_imovel]} · {SITUACAO_LABEL[selected.situacao]}</span>
                  </div>
                </dl>

                <div className="mt-5 rounded-2xl bg-surface p-4">
                  <div className="text-xs text-ink-soft mb-1">Objetivo</div>
                  <div className="text-sm font-medium">{selected.objetivo}</div>
                </div>

                <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${selected.tutorial_concluido ? "bg-green-50 text-green-700" : "bg-surface text-ink-soft"}`}>
                  {selected.tutorial_concluido ? "✓ Tutorial concluído" : "Tutorial pendente"}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
