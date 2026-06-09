import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  UserPlus, ChevronRight, ChevronLeft, Check,
  Trash2, Home, FileText, Clock, MessageSquare,
  User, Building2, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/admin/cadastro-cliente")({
  head: () => ({ meta: [{ title: "Cadastro de Cliente — Gestão Regulariza" }] }),
  component: CadastroClientePage,
});

const STORAGE_KEY = "regulariza-clientes";

interface Client {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  tipo_imovel: string;
  area_m2: string;
  cidade: string;
  estado: string;
  situacao: string;
  objetivo: string;
  urgencia: string;
  observacoes: string;
  cadastrado_em: string;
  tutorial_concluido: boolean;
}

const TIPOS = [
  { id: "casa",       label: "Casa",           icon: Home },
  { id: "apartamento",label: "Apartamento",    icon: Building2 },
  { id: "terreno",    label: "Terreno",        icon: Building2 },
  { id: "comercial",  label: "Sala comercial", icon: Building2 },
  { id: "galpao",     label: "Galpão",         icon: Building2 },
];

const SITUACOES = [
  { id: "sem_escritura",  label: "Imóvel sem escritura",                desc: "Imóvel comprado no papel mas nunca registrado" },
  { id: "matricula",      label: "Matrícula com pendências",            desc: "Registro existe mas tem apontamentos ou erros" },
  { id: "sem_habite",     label: "Sem habite-se / averbação",           desc: "Construção ou reforma sem legalização na prefeitura" },
  { id: "retificacao",    label: "Retificação de área",                 desc: "Área real diferente do que consta na matrícula" },
  { id: "heranca",        label: "Herança / Inventário pendente",       desc: "Imóvel de familiar falecido sem partilha concluída" },
  { id: "usucapiao",      label: "Usucapião",                          desc: "Posse prolongada sem documentação formal" },
  { id: "outro",          label: "Outra situação",                     desc: "Caso específico que precisa de análise" },
];

const OBJETIVOS = [
  "Quero vender o imóvel",
  "Quero financiar o imóvel",
  "Quero regularizar para uso pessoal",
  "Quero deixar em ordem para herança",
  "Quero alugar com documentação correta",
];

const URGENCIAS = [
  { id: "urgente",   label: "Urgente",    desc: "Processo de venda ou herança em andamento" },
  { id: "normal",    label: "Normal",     desc: "Nos próximos meses" },
  { id: "sem_pressa",label: "Sem pressa", desc: "Quero resolver, mas sem prazo específico" },
];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const TUTORIAL_STEPS = [
  {
    icon: FileText,
    title: "1. Como funciona o processo",
    desc: "A regularização passa por 5 etapas: cadastro → análise → profissional designado → tramitação (prefeitura/cartório) → entrega. Você acompanha tudo no painel em tempo real.",
    color: "bg-blue-50 text-blue-700",
  },
  {
    icon: Home,
    title: "2. O que você precisa enviar",
    desc: "Documentos básicos: RG/CPF, comprovante de endereço, escritura ou contrato de compra/venda (se tiver), IPTU. Nosso especialista solicitará o que faltar.",
    color: "bg-yellow-50 text-yellow-700",
  },
  {
    icon: Clock,
    title: "3. Como acompanhar no painel",
    desc: "Acesse /dashboard a qualquer momento. A barra de progresso e as etapas são atualizadas em tempo real pelo profissional responsável. Você recebe notificações em cada avanço.",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: MessageSquare,
    title: "4. Como falar com seu especialista",
    desc: "No painel, aba Mensagens, você fala diretamente com o profissional dedicado ao seu processo. Resposta em até 24h úteis. Sem intermediários.",
    color: "bg-green-50 text-green-700",
  },
];

const EMPTY_FORM: Omit<Client, "id" | "cadastrado_em" | "tutorial_concluido"> = {
  nome: "", email: "", telefone: "", cpf: "",
  tipo_imovel: "", area_m2: "", cidade: "", estado: "",
  situacao: "", objetivo: "", urgencia: "", observacoes: "",
};

function loadClients(): Client[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function CadastroClientePage() {
  const [step,         setStep]         = useState(1);
  const [form,         setForm]         = useState({ ...EMPTY_FORM });
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [saved,        setSaved]        = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialDone, setTutorialDone] = useState(false);
  const [list,         setList]         = useState<Client[]>([]);
  const [view,         setView]         = useState<"list" | "new">("list");

  useEffect(() => { setList(loadClients()); }, []);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!form.nome.trim())   e.nome  = "Nome obrigatório";
      if (!form.email.trim())  e.email = "Email obrigatório";
      if (!form.cpf.trim())    e.cpf   = "CPF obrigatório";
    }
    if (step === 2) {
      if (!form.tipo_imovel)  e.tipo_imovel = "Selecione o tipo do imóvel";
      if (!form.situacao)     e.situacao    = "Selecione a situação";
      if (!form.objetivo)     e.objetivo    = "Selecione o objetivo";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep((s) => Math.min(s + 1, 3)); };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const submit = () => {
    const client: Client = {
      ...form,
      id: crypto.randomUUID(),
      cadastrado_em: new Date().toISOString(),
      tutorial_concluido: tutorialDone,
    };
    const updated = [client, ...loadClients()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setList(updated);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ ...EMPTY_FORM });
      setStep(1);
      setTutorialStep(0);
      setTutorialDone(false);
      setView("list");
    }, 1800);
  };

  const remove = (id: string) => {
    const updated = list.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setList(updated);
  };

  const STEPS = [
    { n: 1, label: "Dados pessoais",   icon: User },
    { n: 2, label: "Situação do imóvel", icon: Home },
    { n: 3, label: "Tutorial",         icon: FileText },
  ];

  if (view === "list") {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Cadastros</div>
            <h1 className="font-serif text-3xl tracking-tight">Cadastro de clientes</h1>
            <p className="mt-1 text-sm text-ink-soft">{list.length} cliente{list.length !== 1 ? "s" : ""} cadastrado{list.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => { setView("new"); setStep(1); setForm({ ...EMPTY_FORM }); }}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Novo cadastro
          </button>
        </div>

        {list.length === 0 ? (
          <div className="rounded-3xl bg-background ring-1 ring-border p-16 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-surface">
              <User className="h-7 w-7 text-ink-soft" />
            </div>
            <h2 className="font-serif text-2xl tracking-tight">Nenhum cliente cadastrado</h2>
            <p className="mt-2 text-sm text-ink-soft">Cadastre o cliente, levante a situação do imóvel e aplique o tutorial de onboarding.</p>
            <button
              onClick={() => setView("new")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background hover:bg-foreground/90 transition-colors"
            >
              <UserPlus className="h-4 w-4" /> Cadastrar primeiro cliente
            </button>
          </div>
        ) : (
          <div className="rounded-3xl bg-background ring-1 ring-border overflow-hidden">
            <ul>
              {list.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  className="flex items-center gap-4 border-b border-border/50 px-6 py-4 last:border-0 hover:bg-surface/40 transition-colors"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background text-xs font-medium">
                    {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{c.nome}</div>
                    <div className="text-xs text-ink-soft">{c.email} · {c.cidade} {c.estado}</div>
                  </div>
                  <div className="hidden sm:block text-sm text-ink-soft">
                    {TIPOS.find((t) => t.id === c.tipo_imovel)?.label}
                  </div>
                  <span className={`hidden sm:inline rounded-full px-2.5 py-1 text-[11px] ${c.tutorial_concluido ? "bg-green-50 text-green-700" : "bg-surface text-ink-soft ring-1 ring-border"}`}>
                    {c.tutorial_concluido ? "✓ Tutorial feito" : "Tutorial pendente"}
                  </span>
                  <div className="text-xs text-ink-soft">{new Date(c.cadastrado_em).toLocaleDateString("pt-BR")}</div>
                  <button onClick={() => remove(c.id)} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  /* ── FORM ── */
  return (
    <div className="mx-auto max-w-[860px] p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => setView("list")} className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-soft hover:bg-surface transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Cadastros</div>
          <h1 className="font-serif text-2xl tracking-tight">Novo cadastro de cliente</h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => step > s.n && setStep(s.n)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
                step === s.n ? "bg-foreground text-background" :
                step > s.n  ? "bg-surface text-foreground cursor-pointer hover:bg-border" :
                "bg-surface text-ink-soft cursor-default"
              }`}
            >
              {step > s.n ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`h-px w-4 ${step > s.n ? "bg-foreground" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
        <AnimatePresence mode="wait">
          {/* STEP 1 */}
          {step === 1 && (
            <motion.div key="cs1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <h2 className="font-serif text-xl">Dados pessoais do cliente</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo *" error={errors.nome}>
                  <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Maria da Silva" className={inp(errors.nome)} />
                </Field>
                <Field label="CPF *" error={errors.cpf}>
                  <input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className={inp(errors.cpf)} />
                </Field>
                <Field label="Email *" error={errors.email}>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="maria@email.com" className={inp(errors.email)} />
                </Field>
                <Field label="Telefone">
                  <input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" className={inp()} />
                </Field>
              </div>
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <motion.div key="cs2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-6">
              <h2 className="font-serif text-xl">Situação do imóvel</h2>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-2">Tipo do imóvel *</label>
                {errors.tipo_imovel && <p className="mb-1 text-xs text-red-500">{errors.tipo_imovel}</p>}
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("tipo_imovel", t.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${form.tipo_imovel === t.id ? "bg-foreground text-background" : "border border-border text-ink-soft hover:border-foreground/30"}`}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Área + localização */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Área aprox. (m²)">
                  <input type="number" value={form.area_m2} onChange={(e) => set("area_m2", e.target.value)} placeholder="120" className={inp()} />
                </Field>
                <Field label="Cidade">
                  <input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="São Paulo" className={inp()} />
                </Field>
                <Field label="Estado">
                  <select value={form.estado} onChange={(e) => set("estado", e.target.value)} className={inp()}>
                    <option value="">Selecione…</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </Field>
              </div>

              {/* Situação */}
              <div>
                <label className="block text-sm font-medium mb-2">Situação atual do imóvel *</label>
                {errors.situacao && <p className="mb-1 text-xs text-red-500">{errors.situacao}</p>}
                <div className="space-y-2">
                  {SITUACOES.map((s) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 transition-colors ring-1 ${form.situacao === s.id ? "ring-foreground bg-surface" : "ring-border hover:ring-foreground/20"}`}
                    >
                      <div className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${form.situacao === s.id ? "border-foreground bg-foreground" : "border-border"}`}>
                        {form.situacao === s.id && <div className="h-2 w-2 rounded-full bg-background" />}
                      </div>
                      <input type="radio" name="situacao" value={s.id} checked={form.situacao === s.id} onChange={() => set("situacao", s.id)} className="sr-only" />
                      <div>
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-ink-soft">{s.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Objetivo */}
              <div>
                <label className="block text-sm font-medium mb-2">Objetivo principal *</label>
                {errors.objetivo && <p className="mb-1 text-xs text-red-500">{errors.objetivo}</p>}
                <select value={form.objetivo} onChange={(e) => set("objetivo", e.target.value)} className={inp(errors.objetivo)}>
                  <option value="">Selecione…</option>
                  {OBJETIVOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Urgência */}
              <div>
                <label className="block text-sm font-medium mb-2">Urgência</label>
                <div className="flex flex-wrap gap-2">
                  {URGENCIAS.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => set("urgencia", u.id)}
                      title={u.desc}
                      className={`rounded-full px-4 py-2 text-sm transition-colors ${form.urgencia === u.id ? "bg-foreground text-background" : "border border-border text-ink-soft hover:border-foreground/30"}`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observações */}
              <Field label="Observações adicionais">
                <textarea
                  value={form.observacoes}
                  onChange={(e) => set("observacoes", e.target.value)}
                  rows={3}
                  placeholder="Informações extras que o profissional deve saber…"
                  className={`${inp()} resize-none`}
                />
              </Field>
            </motion.div>
          )}

          {/* STEP 3 — Tutorial */}
          {step === 3 && (
            <motion.div key="cs3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <div>
                <h2 className="font-serif text-xl">Tutorial do cliente</h2>
                <p className="mt-1 text-sm text-ink-soft">Aplique o tutorial de onboarding ao cliente para que ele entenda o processo completo.</p>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < tutorialStep ? "bg-foreground" : i === tutorialStep ? "bg-accent" : "bg-surface"}`} />
                ))}
                {tutorialDone && <Check className="h-4 w-4 shrink-0 text-green-600" />}
              </div>

              {/* Step card */}
              <AnimatePresence mode="wait">
                {!tutorialDone ? (
                  <motion.div
                    key={tutorialStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {(() => {
                      const s = TUTORIAL_STEPS[tutorialStep];
                      return (
                        <div className={`rounded-3xl p-6 ${s.color}`}>
                          <s.icon className="h-8 w-8 mb-4 opacity-80" />
                          <h3 className="font-serif text-xl leading-snug mb-2">{s.title}</h3>
                          <p className="text-sm leading-relaxed opacity-90">{s.desc}</p>
                        </div>
                      );
                    })()}
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-3xl bg-green-50 p-8 text-center text-green-700"
                  >
                    <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-green-100">
                      <Check className="h-7 w-7" />
                    </div>
                    <h3 className="font-serif text-xl">Tutorial concluído!</h3>
                    <p className="mt-2 text-sm opacity-80">O cliente está pronto para acompanhar o processo no painel.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tutorial nav */}
              {!tutorialDone && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setTutorialStep((s) => Math.max(s - 1, 0))}
                    disabled={tutorialStep === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-ink-soft hover:border-foreground/30 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </button>
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                    <button onClick={() => setTutorialStep((s) => s + 1)}
                      className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:bg-foreground/90 transition-colors">
                      Próximo <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => setTutorialDone(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700 transition-colors">
                      <Check className="h-4 w-4" /> Concluir tutorial
                    </button>
                  )}
                </div>
              )}

              {saved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-green-700"
                >
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Cliente cadastrado com sucesso!</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav buttons */}
        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border">
          {step > 1 ? (
            <button onClick={back} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-ink-soft hover:border-foreground/30 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
          ) : (
            <button onClick={() => setView("list")} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-ink-soft hover:border-foreground/30 transition-colors">
              Cancelar
            </button>
          )}

          {step < 3 ? (
            <button onClick={next} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:bg-foreground/90 transition-colors">
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={saved} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors">
              <UserPlus className="h-4 w-4" /> Salvar cadastro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inp(error?: string) {
  return `w-full rounded-xl border ${error ? "border-red-400" : "border-border"} bg-surface px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors`;
}
