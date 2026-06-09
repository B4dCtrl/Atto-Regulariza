import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  UserPlus, ChevronRight, ChevronLeft, Check,
  Trash2, Plus, Upload, Briefcase, GraduationCap,
  MapPin, ClipboardList, User, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/admin/cadastro-profissional")({
  head: () => ({ meta: [{ title: "Cadastro de Profissional — Gestão Regulariza" }] }),
  component: CadastroProfissionalPage,
});

const STORAGE_KEY = "regulariza-profissionais";

interface Formacao {
  nivel: string;
  curso: string;
  instituicao: string;
  ano: string;
}

interface Professional {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  categoria: string;
  registro_num: string;
  registro_seccional: string;
  anos_experiencia: string;
  areas: string[];
  regioes: string[];
  formacoes: Formacao[];
  resumo: string;
  curriculo_url: string;
  cadastrado_em: string;
  ativo: boolean;
}

const CATEGORIAS = [
  { id: "arquiteto",   label: "Arquiteto(a)",           registro: "CAU" },
  { id: "eng_civil",   label: "Engenheiro(a) Civil",    registro: "CREA" },
  { id: "eng_agrim",   label: "Engenheiro(a) Agrimensor", registro: "CREA" },
  { id: "advogado",    label: "Advogado(a)",             registro: "OAB" },
  { id: "despachante", label: "Despachante imobiliário", registro: "" },
  { id: "outro",       label: "Outro",                   registro: "" },
];

const AREAS = [
  "Regularização de matrícula",
  "Habite-se / Averbação",
  "Georreferenciamento",
  "Usucapião",
  "Retificação de área",
  "Unificação/Desmembramento",
  "Casos de herança/Inventário",
  "Usucapião urbano",
  "Usucapião rural",
];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const NIVEIS = ["Técnico","Graduação","Especialização","MBA","Mestrado","Doutorado"];

const EMPTY_FORM: Omit<Professional, "id" | "cadastrado_em"> = {
  nome: "", email: "", telefone: "", cpf: "",
  categoria: "", registro_num: "", registro_seccional: "", anos_experiencia: "",
  areas: [], regioes: [],
  formacoes: [{ nivel: "Graduação", curso: "", instituicao: "", ano: "" }],
  resumo: "", curriculo_url: "", ativo: true,
};

function loadProfessionals(): Professional[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function CadastroProfissionalPage() {
  const [step,   setStep]   = useState(1);
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [list,   setList]   = useState<Professional[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved,  setSaved]  = useState(false);
  const [view,   setView]   = useState<"list" | "new">("list");

  useEffect(() => { setList(loadProfessionals()); }, []);

  const set = (k: keyof typeof EMPTY_FORM, v: unknown) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const toggleArea = (a: string) =>
    set("areas", form.areas.includes(a) ? form.areas.filter((x) => x !== a) : [...form.areas, a]);

  const toggleUF = (uf: string) =>
    set("regioes", form.regioes.includes(uf) ? form.regioes.filter((x) => x !== uf) : [...form.regioes, uf]);

  const addFormacao = () => set("formacoes", [...form.formacoes, { nivel: "Graduação", curso: "", instituicao: "", ano: "" }]);
  const updateFormacao = (idx: number, patch: Partial<Formacao>) =>
    set("formacoes", form.formacoes.map((f, i) => i === idx ? { ...f, ...patch } : f));
  const removeFormacao = (idx: number) =>
    set("formacoes", form.formacoes.filter((_, i) => i !== idx));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!form.nome.trim())  e.nome  = "Nome obrigatório";
      if (!form.email.trim()) e.email = "Email obrigatório";
      if (!form.cpf.trim())   e.cpf   = "CPF obrigatório";
    }
    if (step === 2) {
      if (!form.categoria)         e.categoria    = "Selecione uma categoria";
      if (form.areas.length === 0) e.areas        = "Selecione ao menos uma área";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep((s) => Math.min(s + 1, 4)); };
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const submit = () => {
    if (!validate()) return;
    const prof: Professional = {
      ...form,
      id: crypto.randomUUID(),
      cadastrado_em: new Date().toISOString(),
    };
    const updated = [prof, ...list];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setList(updated);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ ...EMPTY_FORM });
      setStep(1);
      setView("list");
    }, 1800);
  };

  const remove = (id: string) => {
    const updated = list.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setList(updated);
  };

  const catInfo = CATEGORIAS.find((c) => c.id === form.categoria);

  const STEPS = [
    { n: 1, label: "Dados pessoais",   icon: User },
    { n: 2, label: "Atuação",          icon: Briefcase },
    { n: 3, label: "Formação",         icon: GraduationCap },
    { n: 4, label: "Currículo",        icon: ClipboardList },
  ];

  if (view === "list") {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Cadastros</div>
            <h1 className="font-serif text-3xl tracking-tight">Profissionais</h1>
            <p className="mt-1 text-sm text-ink-soft">{list.length} profissional{list.length !== 1 ? "is" : ""} cadastrado{list.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => { setView("new"); setStep(1); setForm({ ...EMPTY_FORM }); }}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar profissional
          </button>
        </div>

        {list.length === 0 ? (
          <div className="rounded-3xl bg-background ring-1 ring-border p-16 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-surface">
              <Briefcase className="h-7 w-7 text-ink-soft" />
            </div>
            <h2 className="font-serif text-2xl tracking-tight">Nenhum profissional cadastrado</h2>
            <p className="mt-2 text-sm text-ink-soft">Cadastre arquitetos, engenheiros, advogados e despachantes.</p>
            <button
              onClick={() => setView("new")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background hover:bg-foreground/90 transition-colors"
            >
              <UserPlus className="h-4 w-4" /> Cadastrar primeiro profissional
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className="rounded-3xl bg-background ring-1 ring-border p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-background text-sm font-medium">
                      {p.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{p.nome}</div>
                      <div className="text-xs text-ink-soft">{CATEGORIAS.find((c) => c.id === p.categoria)?.label ?? p.categoria}</div>
                    </div>
                  </div>
                  <button onClick={() => remove(p.id)} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-surface transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <dl className="space-y-1.5 text-sm text-ink-soft">
                  <dd>{p.email}</dd>
                  {p.registro_num && (
                    <dd className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-accent" />
                      {CATEGORIAS.find((c) => c.id === p.categoria)?.registro} {p.registro_num}
                      {p.registro_seccional && `/${p.registro_seccional}`}
                    </dd>
                  )}
                  {p.regioes.length > 0 && (
                    <dd className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {p.regioes.slice(0, 3).join(", ")}{p.regioes.length > 3 ? ` +${p.regioes.length - 3}` : ""}
                    </dd>
                  )}
                </dl>

                {p.areas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.areas.slice(0, 3).map((a) => (
                      <span key={a} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-border">{a}</span>
                    ))}
                    {p.areas.length > 3 && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-border">+{p.areas.length - 3}</span>}
                  </div>
                )}

                <div className="mt-4 text-[11px] text-ink-soft">
                  Cadastrado em {new Date(p.cadastrado_em).toLocaleDateString("pt-BR")}
                </div>
              </motion.div>
            ))}
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
          <h1 className="font-serif text-2xl tracking-tight">Novo profissional</h1>
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
              <span className="sm:hidden">{s.n}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`h-px w-4 ${step > s.n ? "bg-foreground" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
        <AnimatePresence mode="wait">
          {/* STEP 1 — Dados pessoais */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <h2 className="font-serif text-xl">Dados pessoais</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo *" error={errors.nome}>
                  <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ana Lima" className={input(errors.nome)} />
                </Field>
                <Field label="CPF *" error={errors.cpf}>
                  <input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className={input(errors.cpf)} />
                </Field>
                <Field label="Email *" error={errors.email}>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="ana@email.com" className={input(errors.email)} />
                </Field>
                <Field label="Telefone">
                  <input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" className={input()} />
                </Field>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — Atuação */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <h2 className="font-serif text-xl">Atuação profissional</h2>

              <Field label="Categoria *" error={errors.categoria}>
                <select value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className={input(errors.categoria)}>
                  <option value="">Selecione…</option>
                  {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>

              {catInfo && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={catInfo.registro ? `Nº de registro (${catInfo.registro})` : "Nº de registro"}>
                    <input value={form.registro_num} onChange={(e) => set("registro_num", e.target.value)} placeholder="000000" className={input()} />
                  </Field>
                  <Field label="Seccional / Estado">
                    <select value={form.registro_seccional} onChange={(e) => set("registro_seccional", e.target.value)} className={input()}>
                      <option value="">Selecione…</option>
                      {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              <Field label="Anos de experiência">
                <select value={form.anos_experiencia} onChange={(e) => set("anos_experiencia", e.target.value)} className={input()}>
                  <option value="">Selecione…</option>
                  {["Menos de 1 ano","1 a 3 anos","3 a 5 anos","5 a 10 anos","Mais de 10 anos"].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>

              <Field label="Áreas de atuação *" error={errors.areas}>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {AREAS.map((a) => (
                    <label key={a} className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ring-1 ${form.areas.includes(a) ? "ring-foreground bg-surface" : "ring-border hover:ring-foreground/30"}`}>
                      <div className={`grid h-4 w-4 place-items-center rounded ${form.areas.includes(a) ? "bg-foreground" : "bg-background ring-1 ring-border"}`}>
                        {form.areas.includes(a) && <Check className="h-3 w-3 text-background" />}
                      </div>
                      <input type="checkbox" checked={form.areas.includes(a)} onChange={() => toggleArea(a)} className="sr-only" />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Regiões de atendimento">
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {UFS.map((uf) => (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => toggleUF(uf)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${form.regioes.includes(uf) ? "bg-foreground text-background" : "border border-border text-ink-soft hover:border-foreground/30"}`}
                    >
                      {uf}
                    </button>
                  ))}
                </div>
              </Field>
            </motion.div>
          )}

          {/* STEP 3 — Formação */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl">Formação acadêmica</h2>
                <button onClick={addFormacao} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink-soft hover:border-foreground/30 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Adicionar formação
                </button>
              </div>

              {form.formacoes.map((f, idx) => (
                <div key={idx} className="rounded-2xl bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-soft">Formação {idx + 1}</span>
                    {form.formacoes.length > 1 && (
                      <button onClick={() => removeFormacao(idx)} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-border transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nível">
                      <select value={f.nivel} onChange={(e) => updateFormacao(idx, { nivel: e.target.value })} className={input()}>
                        {NIVEIS.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label="Ano de conclusão">
                      <input type="number" min="1980" max="2030" value={f.ano} onChange={(e) => updateFormacao(idx, { ano: e.target.value })} placeholder="2018" className={input()} />
                    </Field>
                    <Field label="Curso">
                      <input value={f.curso} onChange={(e) => updateFormacao(idx, { curso: e.target.value })} placeholder="Arquitetura e Urbanismo" className={input()} />
                    </Field>
                    <Field label="Instituição">
                      <input value={f.instituicao} onChange={(e) => updateFormacao(idx, { instituicao: e.target.value })} placeholder="USP" className={input()} />
                    </Field>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* STEP 4 — Currículo */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <h2 className="font-serif text-xl">Currículo e portfólio</h2>

              <Field label="Resumo profissional">
                <textarea
                  value={form.resumo}
                  onChange={(e) => set("resumo", e.target.value)}
                  rows={4}
                  placeholder="Descreva a experiência, diferenciais e principais projetos realizados…"
                  className={`${input()} resize-none`}
                />
              </Field>

              <Field label="Link do currículo (LinkedIn, Lattes ou PDF)">
                <input
                  value={form.curriculo_url}
                  onChange={(e) => set("curriculo_url", e.target.value)}
                  placeholder="https://linkedin.com/in/ana-lima"
                  className={input()}
                />
              </Field>

              <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
                <Upload className="mx-auto h-6 w-6 text-ink-soft" />
                <div className="mt-2 text-sm text-ink-soft">Arraste o PDF do currículo aqui ou</div>
                <button className="mt-2 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-ink-soft hover:border-foreground/30 transition-colors">
                  Selecionar arquivo
                </button>
              </div>

              {saved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-green-700"
                >
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Profissional cadastrado com sucesso!</span>
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

          {step < 4 ? (
            <button onClick={next} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:bg-foreground/90 transition-colors">
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={saved} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors">
              <UserPlus className="h-4 w-4" /> Cadastrar profissional
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function input(error?: string) {
  return `w-full rounded-xl border ${error ? "border-red-400" : "border-border"} bg-surface px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors`;
}
