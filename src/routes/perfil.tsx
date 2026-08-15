import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, User, MapPin, Bell, Shield, Camera, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Regulariza" }] }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: PerfilPage,
});

type Section = "conta" | "endereco" | "notificacoes" | "seguranca";

const SECTIONS = [
  { id: "conta" as Section, label: "Conta", icon: User },
  { id: "endereco" as Section, label: "Endereço", icon: MapPin },
  { id: "notificacoes" as Section, label: "Notificações", icon: Bell },
  { id: "seguranca" as Section, label: "Segurança", icon: Shield },
];

type Profile = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  nascimento: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  notifEmail: boolean;
  notifSms: boolean;
  notifPush: boolean;
  notifAtualizacoes: boolean;
  notifMarketing: boolean;
};

const EMPTY_PROFILE: Profile = {
  nome: "",
  email: "",
  telefone: "",
  cpf: "",
  nascimento: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  notifEmail: true,
  notifSms: false,
  notifPush: false,
  notifAtualizacoes: true,
  notifMarketing: false,
};

const ESTADOS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

/* ── Sub-components ── */
function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
    </label>
  );
}

function StateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">Estado</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none
                   transition-colors focus:border-foreground/30 focus:bg-background"
      >
        <option value="">Selecione…</option>
        {ESTADOS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
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
function PerfilPage() {
  const { userId } = Route.useRouteContext();
  const [active, setActive] = useState<Section>("conta");
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [senha, setSenha] = useState({ atual: "", nova: "", confirmar: "" });
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaTrocada, setSenhaTrocada] = useState(false);

  /**
   * Troca a senha de verdade.
   *
   * Antes o botão chamava `salvar("seguranca")`, que gravava nome, e-mail e
   * preferências em `profiles` e NÃO tocava na senha — os três campos eram
   * coletados e descartados, com a tela dizendo "salvo". O campo "senha atual"
   * também saiu: o Supabase não a exige para quem já tem sessão, e pedir um
   * dado que não é verificado passa uma impressão falsa de conferência.
   */
  async function alterarSenha() {
    setErroSenha(null);
    setSenhaTrocada(false);

    if (senha.nova.length < 8) {
      setErroSenha("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha.nova !== senha.confirmar) {
      setErroSenha("As duas senhas não são iguais.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: senha.nova });
    if (error) {
      setErroSenha(
        error.message.includes("should be different")
          ? "A senha nova precisa ser diferente da atual."
          : "Não foi possível alterar a senha. Tente novamente.",
      );
      return;
    }

    setSenha({ atual: "", nova: "", confirmar: "" });
    setSenhaTrocada(true);
    setTimeout(() => setSenhaTrocada(false), 4000);
  }

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const s = (data.settings ?? {}) as Record<string, boolean>;
        setProfile((p) => ({
          ...p,
          nome: data.name ?? "",
          email: data.email ?? "",
          telefone: data.phone ?? "",
          cpf: data.cpf ?? "",
          cidade: data.city ?? "",
          estado: data.state ?? "",
          notifEmail: s.notifEmail ?? true,
          notifSms: s.notifSms ?? false,
          notifPush: s.notifPush ?? false,
          notifAtualizacoes: s.notifAtualizacoes ?? true,
          notifMarketing: s.notifMarketing ?? false,
        }));
      });
  }, [userId]);

  const set = (field: keyof Profile, val: string | boolean) =>
    setProfile((p) => ({ ...p, [field]: val }));

  async function salvar(section: string) {
    await supabase.from("profiles").upsert({
      id: userId,
      name: profile.nome,
      email: profile.email,
      phone: profile.telefone,
      cpf: profile.cpf,
      city: profile.cidade,
      state: profile.estado,
      role: "cliente",
      settings: {
        notifEmail: profile.notifEmail,
        notifSms: profile.notifSms,
        notifPush: profile.notifPush,
        notifAtualizacoes: profile.notifAtualizacoes,
        notifMarketing: profile.notifMarketing,
      },
    });
    await supabase.auth.updateUser({ data: { name: profile.nome } });
    setSaved((s) => ({ ...s, [section]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [section]: false })), 2200);
  }

  const initials = profile.nome
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-surface/50 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Painel
          </Link>
          <div className="h-5 w-px bg-border" />
          <Link to="/" className="flex items-center">
            <img src="/ato-lockup.png" alt="Ato Regulariza" className="h-7 w-auto object-contain" />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:block">Meu perfil</span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs font-medium text-background">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl tracking-tight">Meu perfil</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Gerencie suas informações, endereço e preferências.
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

          {/* Content */}
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

            {/* ── CONTA ── */}
            {active === "conta" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-6 font-serif text-2xl tracking-tight">Dados da conta</h2>

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
                    <div className="font-medium">{profile.nome}</div>
                    <div className="text-sm text-ink-soft">{profile.email}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      Cliente ativo
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Nome completo"
                    value={profile.nome}
                    onChange={(v) => set("nome", v)}
                  />
                  <Field
                    label="E-mail"
                    type="email"
                    value={profile.email}
                    onChange={(v) => set("email", v)}
                  />
                  <Field
                    label="Telefone"
                    value={profile.telefone}
                    onChange={(v) => set("telefone", v)}
                    placeholder="(00) 00000-0000"
                  />
                  <Field
                    label="CPF"
                    value={profile.cpf}
                    onChange={(v) => set("cpf", v)}
                    placeholder="000.000.000-00"
                  />
                  <Field
                    label="Data de nascimento"
                    type="date"
                    value={profile.nascimento}
                    onChange={(v) => set("nascimento", v)}
                  />
                </div>

                <SaveBtn onClick={() => salvar("conta")} saved={!!saved["conta"]} />
              </section>
            )}

            {/* ── ENDEREÇO ── */}
            {active === "endereco" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-2 font-serif text-2xl tracking-tight">Endereço</h2>
                <p className="mb-8 text-sm text-ink-soft">
                  Usado para consultar exigências municipais do seu imóvel.
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="CEP"
                    value={profile.cep}
                    onChange={(v) => set("cep", v)}
                    placeholder="00000-000"
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Logradouro"
                      value={profile.logradouro}
                      onChange={(v) => set("logradouro", v)}
                      placeholder="Rua, avenida, travessa…"
                    />
                  </div>
                  <Field label="Número" value={profile.numero} onChange={(v) => set("numero", v)} />
                  <Field
                    label="Complemento"
                    value={profile.complemento}
                    onChange={(v) => set("complemento", v)}
                    placeholder="Apto, bloco, casa…"
                  />
                  <Field label="Bairro" value={profile.bairro} onChange={(v) => set("bairro", v)} />
                  <Field label="Cidade" value={profile.cidade} onChange={(v) => set("cidade", v)} />
                  <StateField value={profile.estado} onChange={(v) => set("estado", v)} />
                </div>
                <SaveBtn onClick={() => salvar("endereco")} saved={!!saved["endereco"]} />
              </section>
            )}

            {/* ── NOTIFICAÇÕES ── */}
            {active === "notificacoes" && (
              <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                <h2 className="mb-2 font-serif text-2xl tracking-tight">Notificações</h2>
                <p className="mb-8 text-sm text-ink-soft">
                  Escolha como quer ser avisado sobre seu processo.
                </p>
                <div className="divide-y divide-border/50 space-y-1">
                  <Toggle
                    label="E-mail"
                    desc="Atualizações e mensagens da equipe por e-mail"
                    checked={profile.notifEmail}
                    onChange={(v) => set("notifEmail", v)}
                  />
                  <Toggle
                    label="SMS"
                    desc="Alertas urgentes e lembretes de prazo"
                    checked={profile.notifSms}
                    onChange={(v) => set("notifSms", v)}
                  />
                  <Toggle
                    label="Push (navegador)"
                    desc="Notificações em tempo real no navegador"
                    checked={profile.notifPush}
                    onChange={(v) => set("notifPush", v)}
                  />
                  <div className="pt-3">
                    <div className="px-4 pb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">
                      Preferências de conteúdo
                    </div>
                    <Toggle
                      label="Atualizações do processo"
                      desc="Mudanças de etapa e documentos aprovados"
                      checked={profile.notifAtualizacoes}
                      onChange={(v) => set("notifAtualizacoes", v)}
                    />
                    <Toggle
                      label="Comunicações de marketing"
                      desc="Dicas, novidades e promoções da plataforma"
                      checked={profile.notifMarketing}
                      onChange={(v) => set("notifMarketing", v)}
                    />
                  </div>
                </div>
                <SaveBtn onClick={() => salvar("notificacoes")} saved={!!saved["notificacoes"]} />
              </section>
            )}

            {/* ── SEGURANÇA ── */}
            {active === "seguranca" && (
              <div className="space-y-6">
                <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                  <h2 className="mb-2 font-serif text-2xl tracking-tight">Alterar senha</h2>
                  <p className="mb-6 text-sm text-ink-soft">
                    Use ao menos 8 caracteres com letras e números.
                  </p>
                  <div className="grid max-w-sm gap-5">
                    <Field
                      label="Nova senha"
                      type="password"
                      value={senha.nova}
                      onChange={(v) => setSenha((s) => ({ ...s, nova: v }))}
                    />
                    <Field
                      label="Confirmar nova senha"
                      type="password"
                      value={senha.confirmar}
                      onChange={(v) => setSenha((s) => ({ ...s, confirmar: v }))}
                    />
                  </div>

                  {erroSenha && <p className="mt-3 max-w-sm text-sm text-red-700">{erroSenha}</p>}
                  {senhaTrocada && (
                    <p className="mt-3 max-w-sm text-sm text-green-700">
                      Senha alterada. Ela já vale no próximo acesso.
                    </p>
                  )}

                  <SaveBtn label="Alterar senha" onClick={alterarSenha} saved={senhaTrocada} />
                </section>

                <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
                  <h2 className="mb-2 font-serif text-2xl tracking-tight">Contas vinculadas</h2>
                  <p className="mb-6 text-sm text-ink-soft">
                    Provedores de autenticação conectados à sua conta.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-background ring-1 ring-border">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Google</div>
                        <div className="text-xs text-ink-soft">{profile.email}</div>
                      </div>
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                        Vinculado
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 sm:p-8">
                  <h3 className="mb-1 font-medium text-destructive">Zona de perigo</h3>
                  <p className="mb-4 text-sm text-ink-soft">
                    Ações permanentes e irreversíveis. Prossiga com cuidado.
                  </p>
                  <button className="rounded-full border border-destructive/30 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
                    Excluir minha conta
                  </button>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
