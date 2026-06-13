import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft, User, Award, MapPin, Clock, Bell, CreditCard,
  Camera, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil-profissional")({
  head: () => ({ meta: [{ title: "Meu Perfil — Profissional" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: PerfilProfissionalPage,
});

type Section =
  | "dados"
  | "credenciais"
  | "atuacao"
  | "disponibilidade"
  | "notificacoes"
  | "pagamentos";

const SECTIONS = [
  { id: "dados" as Section,           label: "Dados pessoais",   icon: User       },
  { id: "credenciais" as Section,     label: "Credenciais",      icon: Award      },
  { id: "atuacao" as Section,         label: "Área de atuação",  icon: MapPin     },
  { id: "disponibilidade" as Section, label: "Disponibilidade",  icon: Clock      },
  { id: "notificacoes" as Section,    label: "Notificações",     icon: Bell       },
  { id: "pagamentos" as Section,      label: "Pagamentos",       icon: CreditCard },
];

const ESPECIALIDADES = [
  "Regularização fundiária",
  "Averbação de construção",
  "Usucapião extrajudicial",
  "Desmembramento de lote",
  "Georreferenciamento",
  "Habite-se",
  "ITBI e transmissão",
  "Incorporação imobiliária",
];

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

type ProfProfile = {
  nome: string;
  email: string;
  telefone: string;
  bio: string;
  conselho: string;
  registro: string;
  especialidades: string[];
  estados: string[];
  cidadesPrincipais: string;
  aceitandoCasos: boolean;
  maxCasos: number;
  notifMensagens: boolean;
  notifAtribuicoes: boolean;
  notifPrazo: boolean;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
};

const EMPTY_PROFILE: ProfProfile = {
  nome: "",
  email: "",
  telefone: "",
  bio: "",
  conselho: "",
  registro: "",
  especialidades: [],
  estados: [],
  cidadesPrincipais: "",
  aceitandoCasos: true,
  maxCasos: 8,
  notifMensagens: true,
  notifAtribuicoes: true,
  notifPrazo: true,
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "corrente",
};

/* ── Sub-components ── */
function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none
                   placeholder:text-ink-soft/50 transition-colors focus:border-foreground/30 focus:bg-background"
      />
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none
                   placeholder:text-ink-soft/50 transition-colors focus:border-foreground/30 focus:bg-background"
      />
    </label>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-4 transition-colors hover:bg-surface"
      onClick={() => onChange(!checked)}
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-ink-soft">{desc}</div>
      </div>
      <div
        className={`relative ml-4 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </div>
    </div>
  );
}

function SaveBtn({
  label = "Salvar alterações",
  onClick,
  saved,
}: {
  label?: string;
  onClick: () => void;
  saved: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm transition-all ${
        saved
          ? "bg-accent text-accent-foreground"
          : "bg-foreground text-background hover:bg-foreground/90"
      }`}
    >
      {saved ? (
        <>
          <Check className="h-4 w-4" /> Salvo!
        </>
      ) : (
        label
      )}
    </button>
  );
}

/* ── Page ── */
function PerfilProfissionalPage() {
  const { userId } = Route.useRouteContext();
  const [active, setActive] = useState<Section>("dados");
  const [prof, setProf] = useState<ProfProfile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const s = (data.settings ?? {}) as Record<string, boolean>;
        setProf((p) => ({
          ...p,
          nome: data.name ?? "", email: data.email ?? "", telefone: data.phone ?? "",
          bio: data.bio ?? "", conselho: data.council ?? "", registro: data.registro ?? "",
          especialidades: data.specialties ?? [], estados: data.regions ?? [],
          aceitandoCasos: data.accepting ?? true, maxCasos: data.max_cases ?? 8,
          notifMensagens: s.notifMensagens ?? true, notifAtribuicoes: s.notifAtribuicoes ?? true,
          notifPrazo: s.notifPrazo ?? true,
        }));
      });
  }, [userId]);

  const set = <K extends keyof ProfProfile>(field: K, val: ProfProfile[K]) =>
    setProf((p) => ({ ...p, [field]: val }));

  async function salvar(section: string) {
    await supabase.from("profiles").upsert({
      id: userId, role: "profissional",
      name: prof.nome, email: prof.email, phone: prof.telefone,
      bio: prof.bio, council: prof.conselho, registro: prof.registro,
      specialties: prof.especialidades, regions: prof.estados,
      accepting: prof.aceitandoCasos, max_cases: prof.maxCasos,
      specialization: `${prof.conselho} ${prof.registro}`.trim(),
      settings: {
        notifMensagens: prof.notifMensagens,
        notifAtribuicoes: prof.notifAtribuicoes,
        notifPrazo: prof.notifPrazo,
      },
    });
    await supabase.auth.updateUser({ data: { name: prof.nome } });
    setSaved((s) => ({ ...s, [section]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [section]: false })), 2200);
  }

  const toggleEspecialidade = (e: string) =>
    set(
      "especialidades",
      prof.especialidades.includes(e)
        ? prof.especialidades.filter((x) => x !== e)
        : [...prof.especialidades, e],
    );

  const toggleEstado = (e: string) =>
    set(
      "estados",
      prof.estados.includes(e)
        ? prof.estados.filter((x) => x !== e)
        : [...prof.estados, e],
    );

  const initials = prof.nome
    .split(" ")
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-surface/50 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link
            to="/painel-profissional"
            className="flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Painel
          </Link>
          <div className="h-5 w-px bg-border" />
          <Link to="/" className="flex items-center gap-1.5">
            <img src="/logo-ato.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
            <span className="hidden font-arsenica text-xl leading-none text-accent sm:inline">ato</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:block">Perfil profissional</span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs font-medium text-background">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-serif text-3xl tracking-tight">Perfil profissional</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Configure credenciais, área de atuação e disponibilidade.
          </p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar desktop */}
          <aside className="hidden w-52 shrink-0 md:block">
            <nav className="sticky top-24 space-y-1 rounded-3xl bg-background p-3 ring-1 ring-border">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    active === s.id
                      ? "bg-foreground text-background"
                      : "text-ink-soft hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            {/* Mobile tabs */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                    active === s.id
                      ? "bg-foreground text-background"
                      : "border border-border text-ink-soft hover:border-foreground/30"
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              ))}
            </div>

            {/* ── DADOS PESSOAIS ── */}
            {active === "dados" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-6 font-serif text-2xl tracking-tight">Dados pessoais</h2>

                {/* Avatar */}
                <div className="mb-8 flex items-center gap-5">
                  <div className="relative">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-foreground text-2xl font-medium text-background">
                      {initials}
                    </div>
                    <button className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground ring-2 ring-background">
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <div className="font-medium">{prof.nome}</div>
                    <div className="text-sm text-ink-soft">
                      {prof.conselho} {prof.registro}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {prof.aceitandoCasos ? "Aceitando novos casos" : "Indisponível"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Nome completo"
                    value={prof.nome}
                    onChange={(v) => set("nome", v)}
                  />
                  <Field
                    label="E-mail profissional"
                    type="email"
                    value={prof.email}
                    onChange={(v) => set("email", v)}
                  />
                  <Field
                    label="Telefone / WhatsApp"
                    value={prof.telefone}
                    onChange={(v) => set("telefone", v)}
                    placeholder="(00) 00000-0000"
                  />
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Apresentação / bio"
                      value={prof.bio}
                      onChange={(v) => set("bio", v)}
                      placeholder="Descreva sua experiência, diferenciais e especialidades…"
                      rows={4}
                    />
                  </div>
                </div>

                <SaveBtn onClick={() => salvar("dados")} saved={!!saved["dados"]} />
              </section>
            )}

            {/* ── CREDENCIAIS ── */}
            {active === "credenciais" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-2 font-serif text-2xl tracking-tight">Credenciais</h2>
                <p className="mb-8 text-sm text-ink-soft">
                  Registro profissional e especialidades técnicas.
                </p>

                <div className="mb-8 grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                      Conselho profissional
                    </span>
                    <select
                      value={prof.conselho}
                      onChange={(e) => set("conselho", e.target.value)}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none
                                 transition-colors focus:border-foreground/30 focus:bg-background"
                    >
                      {["CREA", "CAU", "OAB", "TJ", "CRB"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Número de registro"
                    value={prof.registro}
                    onChange={(v) => set("registro", v)}
                    placeholder="ex: SP-123456"
                    hint="Conforme consta no conselho regional"
                  />
                </div>

                <div>
                  <div className="mb-3 text-xs font-medium text-ink-soft">Especialidades</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ESPECIALIDADES.map((e) => {
                      const on = prof.especialidades.includes(e);
                      return (
                        <button
                          key={e}
                          onClick={() => toggleEspecialidade(e)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                            on
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-surface text-ink-soft hover:border-foreground/20 hover:text-foreground"
                          }`}
                        >
                          <div
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-md border transition-colors ${
                              on
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border"
                            }`}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </div>
                          <span className="leading-tight">{e}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <SaveBtn onClick={() => salvar("credenciais")} saved={!!saved["credenciais"]} />
              </section>
            )}

            {/* ── ÁREA DE ATUAÇÃO ── */}
            {active === "atuacao" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-2 font-serif text-2xl tracking-tight">Área de atuação</h2>
                <p className="mb-8 text-sm text-ink-soft">
                  Define onde você atende. Processos da região serão direcionados a você.
                </p>

                <div className="mb-8">
                  <div className="mb-3 text-xs font-medium text-ink-soft">Estados de atuação</div>
                  <div className="flex flex-wrap gap-2">
                    {ESTADOS.map((e) => {
                      const on = prof.estados.includes(e);
                      return (
                        <button
                          key={e}
                          onClick={() => toggleEstado(e)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            on
                              ? "border-accent bg-accent/10 font-medium text-accent"
                              : "border-border text-ink-soft hover:border-foreground/20"
                          }`}
                        >
                          {e}
                        </button>
                      );
                    })}
                  </div>
                  {prof.estados.length > 0 && (
                    <p className="mt-3 text-xs text-ink-soft">
                      {prof.estados.length} estado
                      {prof.estados.length !== 1 ? "s" : ""} selecionado
                      {prof.estados.length !== 1 ? "s" : ""}:{" "}
                      {prof.estados.join(", ")}
                    </p>
                  )}
                </div>

                <Field
                  label="Principais cidades"
                  value={prof.cidadesPrincipais}
                  onChange={(v) => set("cidadesPrincipais", v)}
                  placeholder="ex: São Paulo, Guarulhos, Osasco"
                  hint="Separe por vírgulas. Prioridade na distribuição de processos."
                />

                <SaveBtn onClick={() => salvar("atuacao")} saved={!!saved["atuacao"]} />
              </section>
            )}

            {/* ── DISPONIBILIDADE ── */}
            {active === "disponibilidade" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-2 font-serif text-2xl tracking-tight">Disponibilidade</h2>
                <p className="mb-8 text-sm text-ink-soft">
                  Configure sua capacidade atual de atendimento.
                </p>

                <div className="mb-8 divide-y divide-border/50 space-y-1">
                  <Toggle
                    label="Aceitando novos casos"
                    desc="Quando desativado, nenhum processo novo será direcionado a você"
                    checked={prof.aceitandoCasos}
                    onChange={(v) => set("aceitandoCasos", v)}
                  />
                </div>

                <label className="block max-w-xs">
                  <span className="mb-3 block text-xs font-medium text-ink-soft">
                    Capacidade máxima de casos simultâneos
                  </span>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={prof.maxCasos}
                      onChange={(e) => set("maxCasos", Number(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <div className="grid h-10 w-12 place-items-center rounded-xl border border-border bg-surface text-sm font-medium">
                      {prof.maxCasos}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    Atualmente {prof.maxCasos} caso{prof.maxCasos !== 1 ? "s" : ""} no máximo
                  </p>
                </label>

                <SaveBtn
                  onClick={() => salvar("disponibilidade")}
                  saved={!!saved["disponibilidade"]}
                />
              </section>
            )}

            {/* ── NOTIFICAÇÕES ── */}
            {active === "notificacoes" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-2 font-serif text-2xl tracking-tight">Notificações</h2>
                <p className="mb-8 text-sm text-ink-soft">
                  Alertas do painel profissional e da plataforma.
                </p>
                <div className="divide-y divide-border/50 space-y-1">
                  <Toggle
                    label="Novas mensagens de clientes"
                    desc="Notifique quando um cliente enviar mensagem"
                    checked={prof.notifMensagens}
                    onChange={(v) => set("notifMensagens", v)}
                  />
                  <Toggle
                    label="Atribuição de novos processos"
                    desc="Alerte quando um processo for direcionado a você"
                    checked={prof.notifAtribuicoes}
                    onChange={(v) => set("notifAtribuicoes", v)}
                  />
                  <Toggle
                    label="Alertas de prazo"
                    desc="Lembretes de etapas com prazo próximo"
                    checked={prof.notifPrazo}
                    onChange={(v) => set("notifPrazo", v)}
                  />
                </div>
                <SaveBtn
                  onClick={() => salvar("notificacoes")}
                  saved={!!saved["notificacoes"]}
                />
              </section>
            )}

            {/* ── PAGAMENTOS ── */}
            {active === "pagamentos" && (
              <div className="space-y-6">
                <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                  <h2 className="mb-2 font-serif text-2xl tracking-tight">Dados bancários</h2>
                  <p className="mb-6 text-sm text-ink-soft">
                    Usado para transferência dos honorários pelos processos concluídos.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      label="Banco"
                      value={prof.banco}
                      onChange={(v) => set("banco", v)}
                      placeholder="ex: Nubank, Itaú, Bradesco…"
                    />
                    <Field
                      label="Agência"
                      value={prof.agencia}
                      onChange={(v) => set("agencia", v)}
                      placeholder="0000"
                    />
                    <Field
                      label="Número da conta"
                      value={prof.conta}
                      onChange={(v) => set("conta", v)}
                      placeholder="00000-0"
                    />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                        Tipo de conta
                      </span>
                      <select
                        value={prof.tipoConta}
                        onChange={(e) => set("tipoConta", e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none
                                   transition-colors focus:border-foreground/30 focus:bg-background"
                      >
                        <option value="corrente">Conta corrente</option>
                        <option value="poupanca">Conta poupança</option>
                        <option value="pagamento">Conta de pagamento</option>
                      </select>
                    </label>
                  </div>
                  <SaveBtn
                    label="Salvar dados bancários"
                    onClick={() => salvar("pagamentos")}
                    saved={!!saved["pagamentos"]}
                  />
                </section>

                <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                  <h2 className="mb-2 font-serif text-2xl tracking-tight">
                    Histórico de pagamentos
                  </h2>
                  <p className="text-sm text-ink-soft">Nenhum pagamento registrado ainda.</p>
                  <div className="mt-6 rounded-2xl border border-dashed border-border py-10 text-center">
                    <div className="text-sm text-ink-soft">
                      Os pagamentos aparecerão aqui após a conclusão dos processos.
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
