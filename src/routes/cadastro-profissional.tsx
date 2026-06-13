import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, AlertCircle, Eye, EyeOff, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro-profissional")({
  head: () => ({
    meta: [
      { title: "Trabalhe com regularização — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // "Criar conta" = conta nova. Encerra qualquer sessão ativa para não cair em
  // loop com o login anterior; o formulário aparece sempre limpo.
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.auth.signOut();
  },
  component: CadastroProfissionalPage,
});

const ESPECIALIZACOES = [
  "Arquiteto(a) e Urbanista",
  "Engenheiro(a) Civil",
  "Advogado(a)",
  "Despachante imobiliário",
  "Topógrafo(a) / Agrimensor(a)",
  "Corretor(a) de imóveis",
  "Outro",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "—";
}

function CadastroProfissionalPage() {
  const navigate = useNavigate();
  const [nome,    setNome]    = useState("");
  const [email,   setEmail]   = useState("");
  const [senha,   setSenha]   = useState("");
  const [espec,   setEspec]   = useState("");
  const [registro, setRegistro] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function submit() {
    if (!nome.trim() || !email.trim() || senha.length < 6 || !espec) {
      setError("Preencha nome, email, especialização e uma senha de ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { name: nome, role: "profissional" } },
    });

    if (authErr) {
      setError(
        authErr.message.includes("already registered") || authErr.message.includes("already been registered")
          ? "Este email já tem uma conta. Faça login em /entrar."
          : authErr.message,
      );
      setLoading(false);
      return;
    }

    const uid = authData.user?.id;
    if (!uid) {
      setError("Erro ao criar conta. Tente novamente.");
      setLoading(false);
      return;
    }

    // Cria/atualiza o perfil de profissional (upsert evita conflito com trigger de signup).
    // Se a confirmação de e-mail estiver ligada, não há sessão e este upsert é bloqueado
    // pelo RLS — nesse caso o perfil é criado no 1º acesso ao painel (self-heal).
    await supabase.from("profiles").upsert({
      id: uid,
      name: nome,
      email,
      initials: initialsOf(nome),
      role: "profissional",
      specialization: registro.trim() ? `${espec} · ${registro.trim()}` : espec,
    });

    setLoading(false);

    // Confirmação ligada → sem sessão: mostra tela "confirme seu e-mail".
    if (!authData.session) {
      setConfirmSent(true);
      return;
    }

    navigate({ to: "/painel-profissional" });
  }

  if (confirmSent) {
    return (
      <div className="min-h-screen bg-surface/40 flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <div className="font-arsenica text-2xl text-accent">ato</div>
          <div className="text-xs uppercase tracking-widest text-ink-soft">Regulariza · Profissionais</div>
        </div>
        <div className="w-full max-w-[460px] rounded-3xl bg-background ring-1 ring-border p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl mb-2">Conta criada! Confirme seu e-mail</h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            Enviamos um e-mail de confirmação para <strong className="text-foreground">{email}</strong>.
            Clique no link da mensagem da <strong className="text-foreground">Ato Regulariza</strong> para
            ativar sua conta e acessar o painel do profissional.
          </p>
          <p className="mt-4 text-xs text-ink-soft">
            Não recebeu? Verifique a caixa de spam. Já confirmou?{" "}
            <Link to="/entrar" className="underline hover:text-foreground">Entrar</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface/40 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="font-arsenica text-2xl text-accent">ato</div>
        <div className="text-xs uppercase tracking-widest text-ink-soft">Regulariza · Profissionais</div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl bg-background ring-1 ring-border p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl tracking-tight leading-none">Trabalhe conosco</h1>
            <p className="text-sm text-ink-soft mt-1">Crie sua conta de profissional.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nome completo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Carla Rocha" className={inp()} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Especialização</label>
            <select value={espec} onChange={(e) => setEspec(e.target.value)} className={inp()}>
              <option value="">Selecione…</option>
              {ESPECIALIZACOES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Registro profissional <span className="text-ink-soft font-normal">(opcional)</span>
            </label>
            <input
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
              placeholder="CREA/CAU/OAB — ex: CAU A12345-6"
              className={inp()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className={inp()} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Senha (mín. 6 caracteres)</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className={`${inp()} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-foreground"
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm text-background hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta…</>
            : <><Check className="h-4 w-4" /> Criar conta de profissional</>
          }
        </button>
      </motion.div>

      <p className="mt-6 text-xs text-ink-soft">
        Já tem conta?{" "}
        <Link to="/entrar" className="underline hover:text-foreground">Entrar</Link>
      </p>
    </div>
  );
}

function inp() {
  return "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors";
}
