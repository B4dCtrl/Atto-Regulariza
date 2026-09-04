import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowUpRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  X,
  Building2,
  Briefcase,
  Loader2,
} from "lucide-react";
import { SessaoEmAberto } from "@/components/conta/SessaoEmAberto";
import { supabase } from "@/integrations/supabase/client";
import { resolveLandingPath } from "@/lib/auth-routing";
import { getRequestHost } from "@/lib/request-host.server";

/**
 * No subdomínio curso.atoregulariza.com.br, o pós-login SEMPRE vai pra
 * /cursos — não importa o papel do usuário (admin/cliente/profissional).
 * Sem isso, um admin sem curso liberado cairia em /admin *dentro* do
 * subdomínio de curso, parecendo "voltar pro site principal".
 */
function isCursoHost(host: string) {
  return host.startsWith("curso.");
}

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Ato Regulariza" },
      {
        name: "description",
        content:
          "Acesse seu painel da Ato Regulariza e acompanhe a regularização do seu imóvel em tempo real.",
      },
    ],
  }),
  // Aceita ?de=painel — a marca que a rota protegida deixa ao desviar para cá.
  // A chave é OPCIONAL: declarada como `de: "painel" | undefined`, o roteador
  // passa a exigi-la em todo <Link to="/entrar"> do site.
  validateSearch: (busca: Record<string, unknown>): { de?: "painel" } =>
    busca.de === "painel" ? { de: "painel" } : {},
  // Sessão ativa NÃO entra sozinha.
  //
  // Antes esta rota redirecionava direto ao painel de quem estivesse conectado.
  // Resultado: quem confirmava um cadastro novo e clicava em "Entrar" caía na
  // conta de outra pessoa — a última a usar aquele navegador. A tela agora
  // mostra quem está e deixa escolher.
  //
  // O subdomínio de cursos continua com o desvio: lá o destino não depende de
  // quem é a pessoa.
  beforeLoad: async ({ search }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const host = await getRequestHost();
    if (isCursoHost(host) && session) throw redirect({ to: "/cursos" });

    // A volta do desvio transitório NÃO pode ficar aqui: `beforeLoad` roda no
    // servidor durante o SSR, onde não existe localStorage e a sessão é sempre
    // nula — e não roda de novo na hidratação. A checagem vive no componente,
    // em `useEffect`, que é onde o navegador de fato executa.
  },
  component: EntrarPage,
});

type Mode = "login" | "forgot";

function EntrarPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  /** Há sessão de outra visita neste navegador? */
  const [temSessao, setTemSessao] = useState(false);
  /** Chegou aqui por desvio de rota protegida? Então pode ser sessão ainda não restaurada. */
  const { de } = Route.useSearch();
  const [restaurando, setRestaurando] = useState(de === "painel");

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!ativo) return;
      setTemSessao(!!session);

      // Desvio transitório: a rota protegida checou a sessão durante o SSR,
      // onde ela nunca existe, e mandou para cá. Quem tem sessão válida volta
      // ao painel na hora — sem isto, atualizar com F5 parecia deslogar.
      //
      // Só com a marca `?de=painel`. Quem digita /entrar continua vendo quem
      // está conectado e escolhendo: é a proteção de computador compartilhado.
      if (de === "painel" && session) {
        await navigate({ to: await resolveLandingPath(session.user.id), replace: true });
        return;
      }
      setRestaurando(false);
    });
    return () => {
      ativo = false;
    };
  }, [de, navigate]);

  // Carrossel do mini-status (mock ilustrativo) — troca sozinho a cada 2.6s
  const STATUS_STEPS = [
    { label: "Com profissional", pct: 35, done: "2 de 6 etapas · ~10 dias" },
    { label: "Em prefeitura", pct: 70, done: "4 de 6 etapas · ~5 dias" },
    { label: "Matrícula averbada", pct: 100, done: "6 de 6 etapas · concluído" },
  ];
  const [statusStep, setStatusStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStatusStep((s) => (s + 1) % STATUS_STEPS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  /* ── Login e-mail/senha ─────────────────────────────────────── */
  async function handleEmailLogin(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(translateError(authError?.message ?? ""));
    } else if (isCursoHost(window.location.hostname)) {
      // No subdomínio de curso, sempre vai pra /cursos — ignora o papel
      await navigate({ to: "/cursos" });
    } else {
      // Admin → back-office, profissional → painel-profissional, cliente → dashboard
      await navigate({ to: await resolveLandingPath(data.user.id) });
    }

    setLoading(false);
  }

  /* ── Redefinir senha ────────────────────────────────────────── */
  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    // Aponta para a tela que realmente troca a senha. Antes apontava para
    // /entrar, que via a sessão de recuperação e redirecionava ao painel — o
    // link virava um login e a senha nunca mudava.
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (authError) {
      setError(translateError(authError.message));
    } else {
      setSuccess("Link enviado! Verifique sua caixa de entrada para redefinir a senha.");
    }

    setLoading(false);
  }

  /* ── Google OAuth ───────────────────────────────────────────── */
  async function handleGoogle() {
    clearMessages();
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Volta para /entrar, não para /dashboard.
        //
        // O destino depende do papel — profissional e admin têm painel próprio,
        // e mandar todo mundo ao painel do cliente fazia a pessoa cair numa
        // tela que não é a dela. A marca `?de=painel` aciona a resolução por
        // papel que a própria tela de entrada já faz.
        redirectTo: `${window.location.origin}/entrar?de=painel`,
      },
    });

    if (authError) setError(translateError(authError.message));
    setLoading(false);
  }

  /* ── Traduz mensagens de erro do Supabase ───────────────────── */
  function translateError(msg: string): string {
    if (msg.includes("Invalid login credentials"))
      return "E-mail ou senha incorretos. Verifique e tente novamente.";
    if (msg.includes("Email not confirmed"))
      return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
    if (msg.includes("User already registered"))
      return "Este e-mail já está cadastrado. Faça login ou redefina sua senha.";
    if (msg.includes("Password should be at least"))
      return "A senha precisa ter pelo menos 6 caracteres.";
    if (msg.includes("Unable to validate email"))
      return "E-mail inválido. Verifique e tente novamente.";
    return "Algo deu errado. Tente novamente em instantes.";
  }

  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  const onSubmit = isForgot ? handleForgot : handleEmailLogin;

  const titles = {
    login: "Bem-vindo de volta.",
    forgot: "Redefinir senha.",
  };

  const subs = {
    login: "Acesse seu painel e veja onde está sua regularização.",
    forgot: "Enviaremos um link para redefinir sua senha.",
  };

  // Enquanto decide se devolve ao painel, não mostra o formulário: piscar uma
  // tela de login para quem está logado é o que fazia parecer que deslogou.
  if (restaurando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-background text-foreground md:grid-cols-2">
      {/* ── Painel esquerdo — brand ────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background md:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(60% 80% at 20% 0%, oklch(0.66 0.18 38 / 0.45), transparent 70%)",
          }}
        />

        {/* Grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        <Link to="/" className="relative flex items-center">
          <img src="/ato-lockup.png" alt="Ato Regulariza" className="h-9 w-auto object-contain" />
        </Link>

        <div className="relative">
          <p className="font-serif text-4xl leading-tight tracking-tight text-balance">
            Entenda cada etapa da regularização do seu imóvel, do começo ao fim.
          </p>
        </div>

        {/* Mini status mock — carrossel automático, mesmo tamanho sempre */}
        <div className="relative rounded-2xl bg-background/10 p-4 ring-1 ring-background/20 backdrop-blur-sm">
          <div className="text-xs text-background/60">Status atual</div>
          <div className="relative mt-1 h-8 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={statusStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 font-serif text-2xl"
              >
                {STATUS_STEPS[statusStep].label}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background/15">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${STATUS_STEPS[statusStep].pct}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="relative mt-2 h-4 overflow-hidden text-xs text-background/60">
            <AnimatePresence mode="wait">
              <motion.div
                key={statusStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0"
              >
                {STATUS_STEPS[statusStep].done}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo mobile */}
          <Link to="/" className="mb-8 flex items-center md:hidden">
            <img src="/ato-lockup.png" alt="Ato Regulariza" className="h-8 w-auto object-contain" />
          </Link>

          {/* Título animado por mode */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <h1 className="font-serif text-4xl leading-tight tracking-tight">{titles[mode]}</h1>
              <p className="mt-2 text-sm text-ink-soft">{subs[mode]}</p>
            </motion.div>
          </AnimatePresence>

          {/* Mensagem de erro */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mensagem de sucesso */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {success}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sessão de outra visita neste navegador.
              Fica ACIMA do formulário, não no lugar dele: quem quer entrar
              como outra pessoa não precisa de um clique extra para chegar aos
              campos. */}
          {temSessao && (
            <div className="mt-8">
              <SessaoEmAberto aoTrocar={() => setTemSessao(false)} />
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {/* Campo e-mail */}
            <label className="block">
              <span className="text-xs text-ink-soft">E-mail</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 focus-within:border-foreground/40 transition-colors">
                <Mail className="h-4 w-4 text-ink-soft" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearMessages();
                  }}
                  placeholder="voce@email.com"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/60"
                />
              </div>
            </label>

            {/* Campo senha (oculto em forgot) */}
            {!isForgot && (
              <label className="block">
                <span className="text-xs text-ink-soft">Senha</span>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 focus-within:border-foreground/40 transition-colors">
                  <Lock className="h-4 w-4 shrink-0 text-ink-soft" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearMessages();
                    }}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="shrink-0 text-ink-soft hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isLogin && (
                  <div className="mt-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        clearMessages();
                      }}
                      className="text-xs text-ink-soft hover:text-foreground transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}
              </label>
            )}

            {/* Botão submit */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-full
                         bg-foreground py-3 pl-5 pr-3 text-sm text-background
                         transition-all hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "Aguarde..." : isForgot ? "Enviar link" : "Entrar no meu painel"}
              {!loading && (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          {/* Separador + Google */}
          {!isForgot && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-ink-soft">
                <div className="h-px flex-1 bg-border" />
                ou continue com
                <div className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-border
                           bg-surface-elevated py-3 text-sm transition-colors hover:border-foreground/30
                           disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.26 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38z"
                  />
                </svg>
                Entrar com Google
              </button>
            </>
          )}

          {/* Alternância de modo */}
          <p className="mt-6 text-center text-sm text-ink-soft">
            {isForgot ? (
              <>
                Lembrou a senha?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    clearMessages();
                  }}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Entrar
                </button>
              </>
            ) : (
              <>
                Ainda não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleModal(true);
                    clearMessages();
                  }}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Criar conta grátis
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>

      {/* ── Modal de seleção de perfil ─────────────────────────── */}
      <AnimatePresence>
        {showRoleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowRoleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-background p-8 shadow-2xl ring-1 ring-border"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-serif text-2xl tracking-tight">Criar conta grátis</h2>
                  <p className="text-sm text-ink-soft mt-1">Como você quer usar a plataforma?</p>
                </div>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Opções */}
              <div className="space-y-3">
                <Link
                  to="/cadastrar"
                  onClick={() => setShowRoleModal(false)}
                  className="group flex items-center gap-4 rounded-2xl border border-border p-5 hover:border-foreground/40 hover:bg-surface transition-all"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-background transition-colors">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Sou cliente</div>
                    <div className="text-xs text-ink-soft mt-0.5">Quero regularizar meu imóvel</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <Link
                  to="/cadastro-profissional"
                  onClick={() => setShowRoleModal(false)}
                  className="group flex items-center gap-4 rounded-2xl border border-border p-5 hover:border-foreground/40 hover:bg-surface transition-all"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-foreground/5 text-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">Sou profissional</div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      Quero trabalhar com regularização
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>

              <p className="mt-5 text-center text-xs text-ink-soft">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Entrar
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
