import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createClientIntakeBrowser, type IntakeData } from "@/lib/client-intake";

export const Route = createFileRoute("/cadastrar")({
  head: () => ({ meta: [{ title: "Regularize seu imóvel — Ato Regulariza" }] }),
  // "Criar conta" = conta nova. Encerra qualquer sessão ativa para não cair em
  // loop com o login anterior; o formulário aparece sempre limpo.
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.auth.signOut();
  },
  component: CadastrarPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardData = {
  tipo_imovel:  string;
  tem_escritura: string;
  situacao:     string;
  cidade:       string;
  estado:       string;
  area_m2:      string;
  objetivo:     string;
  nome_projeto: string;
  nome:         string;
  email:        string;
  senha:        string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPOS = [
  { id: "casa",        emoji: "🏠", label: "Casa"            },
  { id: "apartamento", emoji: "🏢", label: "Apartamento"     },
  { id: "terreno",     emoji: "🌿", label: "Terreno"         },
  { id: "comercial",   emoji: "🏪", label: "Sala comercial"  },
  { id: "rural",       emoji: "🌾", label: "Imóvel rural"    },
  { id: "outro",       emoji: "📋", label: "Outro"           },
];

const SITUACOES_COM_ESCRITURA = [
  { id: "matricula_pendencia", label: "Matrícula com pendências",       desc: "Registro existe mas tem apontamentos ou erros" },
  { id: "sem_habite",          label: "Sem habite-se / averbação",      desc: "Construção ou reforma sem aprovação na prefeitura" },
  { id: "retificacao",         label: "Retificação de área",            desc: "Área real diferente do que consta no registro" },
  { id: "heranca",             label: "Herança / inventário",           desc: "Imóvel de familiar falecido sem partilha" },
  { id: "outro",               label: "Outra situação",                 desc: "Caso específico que precisa de análise" },
];

const SITUACOES_SEM_ESCRITURA = [
  { id: "sem_escritura",   label: "Nunca teve escritura",               desc: "Comprado no papel ou de boca, sem registro" },
  { id: "escritura_velha", label: "Escritura antiga não registrada",    desc: "Tem o documento mas nunca foi ao cartório" },
  { id: "usucapiao",       label: "Usucapião",                          desc: "Morando há muitos anos sem documento formal" },
  { id: "heranca_s_doc",   label: "Herança sem documentação",           desc: "Herdou mas não tem como provar" },
  { id: "outro",           label: "Outra situação",                     desc: "Caso específico que precisa de análise" },
];

const OBJETIVOS = [
  "Quero vender o imóvel",
  "Quero financiar / fazer crédito",
  "Regularizar para uso pessoal",
  "Deixar em ordem para herança",
  "Alugar com documentação correta",
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

const EMPTY: WizardData = {
  tipo_imovel: "", tem_escritura: "", situacao: "",
  cidade: "", estado: "", area_m2: "",
  objetivo: "",
  nome_projeto: "", nome: "", email: "", senha: "",
};

const TOTAL_STEPS = 6;

// ─── Component ───────────────────────────────────────────────────────────────

function CadastrarPage() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(1);
  const [data,    setData]    = useState<WizardData>({ ...EMPTY });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const set = (k: keyof WizardData, v: string) => setData((d) => ({ ...d, [k]: v }));

  const progress = ((step - 1) / TOTAL_STEPS) * 100;

  const situacoes = data.tem_escritura === "sim"
    ? SITUACOES_COM_ESCRITURA
    : SITUACOES_SEM_ESCRITURA;

  const situacaoLabel =
    [...SITUACOES_COM_ESCRITURA, ...SITUACOES_SEM_ESCRITURA].find((s) => s.id === data.situacao)?.label
    ?? data.situacao;

  function canNext(): boolean {
    if (step === 1) return !!data.tipo_imovel;
    if (step === 2) return !!data.tem_escritura;
    if (step === 3) return !!data.situacao;
    if (step === 4) return !!data.cidade && !!data.estado;
    if (step === 5) return !!data.objetivo;
    return true;
  }

  const next = () => { if (canNext()) setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  async function submit() {
    if (!data.nome.trim() || !data.email.trim() || data.senha.length < 6) {
      setError("Preencha todos os campos. A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);

    // Captura o lead antes (funciona mesmo se o signup falhar)
    await supabase.from("leads").insert({
      name:        data.nome,
      email:       data.email,
      city:        data.cidade,
      state:       data.estado,
      tipo_imovel: data.tipo_imovel,
      situacao:    data.situacao,
      objetivo:    data.objetivo,
      source:      "wizard",
    });

    // Intake guardado nos metadados → se a conta exigir confirmação de e-mail,
    // o processo é montado no 1º login (self-heal no dashboard), sem service role.
    const intake: IntakeData = {
      nome: data.nome, email: data.email, cidade: data.cidade, estado: data.estado,
      tipo_imovel: data.tipo_imovel, situacao: data.situacao,
      objetivo: data.objetivo, nome_projeto: data.nome_projeto,
    };

    // Criar conta
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    data.email,
      password: data.senha,
      options:  { data: { name: data.nome, first_login: true, intake } },
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

    // Sem confirmação de e-mail → já há sessão: cria o processo no navegador agora.
    if (authData.session) {
      try {
        await createClientIntakeBrowser(uid, intake);
      } catch (e) {
        setError(`Conta criada, mas houve um erro ao montar seu processo: ${(e as Error).message}`);
        setLoading(false);
        return;
      }
      setLoading(false);
      // ?welcome=1 dispara tutorial + busca de profissional.
      navigate({ to: "/dashboard", search: { welcome: "1" } as never });
      return;
    }

    // Confirmação ligada → sem sessão. O processo é montado no 1º login (self-heal).
    setLoading(false);
    setConfirmSent(true);
  }

  if (confirmSent) {
    return (
      <div className="min-h-screen bg-surface/40 flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <img src="/ato-lockup.png" alt="Ato Regulariza" className="mx-auto h-12 w-auto object-contain" />
          <div className="mt-2 text-xs uppercase tracking-widest text-ink-soft">Regulariza</div>
        </div>
        <div className="w-full max-w-[460px] rounded-3xl bg-background ring-1 ring-border p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl mb-2">Conta criada! Confirme seu e-mail</h1>
          <p className="text-sm text-ink-soft leading-relaxed">
            Enviamos um e-mail de confirmação para <strong className="text-foreground">{data.email}</strong>.
            Clique no link da mensagem da <strong className="text-foreground">Ato Regulariza</strong> para
            ativar sua conta e acessar seu painel.
          </p>
          <p className="mt-4 text-xs text-ink-soft">
            Não recebeu? Verifique a caixa de spam. Já confirmou?{" "}
            <a href="/entrar" className="underline hover:text-foreground">Entrar</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface/40 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img src="/ato-lockup.png" alt="Ato Regulariza" className="mx-auto h-12 w-auto object-contain" />
        <div className="mt-2 text-xs uppercase tracking-widest text-ink-soft">Regulariza</div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 w-full max-w-[520px]">
        <div className="flex justify-between text-[11px] text-ink-soft mb-2">
          <span>Etapa {step} de {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}% completo</span>
        </div>
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="w-full max-w-[520px] rounded-3xl bg-background ring-1 ring-border p-8 shadow-sm">
        <AnimatePresence mode="wait">
          {/* ── PASSO 1: Tipo do imóvel ── */}
          {step === 1 && (
            <motion.div key="s1" {...slide}>
              <h1 className="font-serif text-2xl mb-1">Que tipo de imóvel é?</h1>
              <p className="text-sm text-ink-soft mb-6">
                Vamos entender sua situação para indicar o melhor caminho.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TIPOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set("tipo_imovel", t.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-sm transition-all ring-1
                      ${data.tipo_imovel === t.id
                        ? "ring-foreground bg-foreground text-background"
                        : "ring-border hover:ring-foreground/30"}`}
                  >
                    <span className="text-2xl">
                      {data.tipo_imovel === t.id ? <Check className="h-6 w-6" /> : t.emoji}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PASSO 2: Tem escritura? ── */}
          {step === 2 && (
            <motion.div key="s2" {...slide}>
              <h1 className="font-serif text-2xl mb-1">Tem escritura ou matrícula?</h1>
              <p className="text-sm text-ink-soft mb-6">
                Isso define qual tipo de regularização é necessária.
              </p>
              <div className="space-y-3">
                {[
                  { id: "sim",     label: "Sim, tem escritura ou matrícula", desc: "Existe um documento mas pode ter pendências" },
                  { id: "nao",     label: "Não tem escritura",                desc: "Nunca foi registrado ou está só no papel" },
                  { id: "nao_sei", label: "Não tenho certeza",               desc: "Vou verificar — pode analisar meu caso?" },
                ].map((op) => (
                  <label
                    key={op.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition-colors
                      ${data.tem_escritura === op.id ? "ring-foreground bg-surface" : "ring-border hover:ring-foreground/20"}`}
                  >
                    <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center
                      ${data.tem_escritura === op.id ? "border-foreground bg-foreground" : "border-border"}`}>
                      {data.tem_escritura === op.id && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                    </div>
                    <input type="radio" className="sr-only" value={op.id} onChange={() => set("tem_escritura", op.id)} />
                    <div>
                      <div className="text-sm font-medium">{op.label}</div>
                      <div className="text-xs text-ink-soft">{op.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PASSO 3: Situação específica ── */}
          {step === 3 && (
            <motion.div key="s3" {...slide}>
              <h1 className="font-serif text-2xl mb-1">Qual é a situação principal?</h1>
              <p className="text-sm text-ink-soft mb-6">Escolha a que melhor descreve seu imóvel.</p>
              <div className="space-y-2">
                {situacoes.map((s) => (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition-colors
                      ${data.situacao === s.id ? "ring-foreground bg-surface" : "ring-border hover:ring-foreground/20"}`}
                  >
                    <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center
                      ${data.situacao === s.id ? "border-foreground bg-foreground" : "border-border"}`}>
                      {data.situacao === s.id && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                    </div>
                    <input type="radio" className="sr-only" value={s.id} onChange={() => set("situacao", s.id)} />
                    <div>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-ink-soft">{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PASSO 4: Localização ── */}
          {step === 4 && (
            <motion.div key="s4" {...slide}>
              <h1 className="font-serif text-2xl mb-1">Onde fica o imóvel?</h1>
              <p className="text-sm text-ink-soft mb-6">
                Para identificar a legislação e cartório responsável.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Cidade *</label>
                  <input
                    value={data.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                    placeholder="São Paulo"
                    className={inp()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Estado *</label>
                  <select value={data.estado} onChange={(e) => set("estado", e.target.value)} className={inp()}>
                    <option value="">Selecione…</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Área aproximada (m²)</label>
                  <input
                    type="number"
                    value={data.area_m2}
                    onChange={(e) => set("area_m2", e.target.value)}
                    placeholder="120"
                    className={inp()}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PASSO 5: Objetivo ── */}
          {step === 5 && (
            <motion.div key="s5" {...slide}>
              <h1 className="font-serif text-2xl mb-1">Qual é seu objetivo?</h1>
              <p className="text-sm text-ink-soft mb-5">
                Ajuda a equipe a entender o que você precisa.
              </p>
              <div className="space-y-3 mb-6">
                {OBJETIVOS.map((o) => (
                  <label
                    key={o}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors
                      ${data.objetivo === o ? "ring-foreground bg-surface" : "ring-border hover:ring-foreground/20"}`}
                  >
                    <div className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center
                      ${data.objetivo === o ? "border-foreground bg-foreground" : "border-border"}`}>
                      {data.objetivo === o && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                    </div>
                    <input type="radio" className="sr-only" value={o} onChange={() => set("objetivo", o)} />
                    <span className="text-sm">{o}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PASSO 6: Criar conta ── */}
          {step === 6 && (
            <motion.div key="s6" {...slide}>
              <h1 className="font-serif text-2xl mb-1">Crie sua conta</h1>
              <p className="text-sm text-ink-soft mb-6">Para acompanhar seu processo em tempo real.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nome completo</label>
                  <input
                    value={data.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    placeholder="Maria da Silva"
                    className={inp()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Nome do projeto <span className="text-ink-soft font-normal">(opcional)</span>
                  </label>
                  <input
                    value={data.nome_projeto}
                    onChange={(e) => set("nome_projeto", e.target.value)}
                    placeholder={data.nome ? `${data.nome} — ${situacaoLabel}` : "Ex: Casa da praia"}
                    className={inp()}
                  />
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Como você quer chamar este processo. Se deixar em branco, usaremos seu nome e a situação.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    value={data.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="maria@email.com"
                    className={inp()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Senha (mín. 6 caracteres)</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={data.senha}
                      onChange={(e) => set("senha", e.target.value)}
                      placeholder="••••••••"
                      className={`${inp()} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-foreground"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumo diagnóstico */}
              <div className="mt-5 rounded-2xl bg-accent/10 p-4">
                <div className="text-[11px] font-medium text-accent uppercase tracking-wide mb-2">Seu diagnóstico</div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-ink-soft">Imóvel: </span>
                    {TIPOS.find((t) => t.id === data.tipo_imovel)?.label ?? data.tipo_imovel}
                    {data.cidade ? ` em ${data.cidade}/${data.estado}` : ""}
                  </div>
                  <div>
                    <span className="text-ink-soft">Situação: </span>
                    {[...SITUACOES_COM_ESCRITURA, ...SITUACOES_SEM_ESCRITURA].find((s) => s.id === data.situacao)?.label ?? data.situacao}
                  </div>
                  <div>
                    <span className="text-ink-soft">Objetivo: </span>{data.objetivo}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nav buttons ── */}
        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border">
          <button
            onClick={back}
            disabled={step === 1}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-ink-soft
              hover:border-foreground/30 disabled:opacity-0 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              disabled={!canNext()}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background
                hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2 text-sm text-white
                hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta…</>
                : <><Check className="h-4 w-4" /> Criar conta e acessar</>
              }
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Já tem conta?{" "}
        <a href="/entrar" className="underline hover:text-foreground">Entrar</a>
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inp() {
  return "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors";
}

const slide = {
  initial:    { opacity: 0, x: 16 },
  animate:    { opacity: 1, x: 0  },
  exit:       { opacity: 0, x: -16 },
  transition: { duration: 0.2 },
};
