import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, type FormEvent } from "react";
import {
  ArrowLeft, Bell, Briefcase, Building2, Check, CheckCircle2,
  ChevronRight, FileText, MapPin, MessageSquare, Plus,
  Send, Upload, User, BookOpen, StickyNote,
  AlertTriangle, Phone, Mail,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/painel-profissional")({
  head: () => ({
    meta: [
      { title: "Painel do Profissional — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfissionalPage,
});

/* ─────────────────────────────────────────────── Types */
type Urgency = "alta" | "media" | "baixa";
type FieldType = "text" | "textarea" | "date" | "number" | "select" | "checklist" | "checkbox";
type FieldVal  = string | string[] | boolean;
type RightTab  = "docs" | "chat" | "briefing";

interface MockProcess {
  id: string;
  name: string;
  client: string;
  clientPhone: string;
  clientEmail: string;
  city: string;
  state: string;
  type: string;
  area: number;
  urgency: Urgency;
  situation: string;
}

interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  checkLabel?: string;
}

interface StageDef {
  num: number;
  label: string;
  desc: string;
  fields: FieldDef[];
}

interface LocalMsg {
  id: string;
  text: string;
  isClient: boolean;
  sender: string;
  ts: string;
}

interface LocalDoc {
  id: string;
  name: string;
  size: string;
  ts: string;
  status: "Enviado" | "Em análise" | "Aprovado";
  by: "prof" | "client";
}

/* ─────────────────────────────────────────────── Data */
const PROF_NAME     = "Carla Rocha";
const PROF_INITIALS = "CR";

const MOCK_PROCESSES: MockProcess[] = [
  { id:"p1", name:"Residência Jardim América",   client:"Roberto Alves",      clientPhone:"(11) 99234-5678", clientEmail:"roberto@email.com",   city:"São Paulo",        state:"SP", type:"Averbação de construção",      area:145,  urgency:"alta",  situation:"Construção não averbada desde 2018. Imóvel financiado, banco exige regularização." },
  { id:"p2", name:"Apto Centro Histórico",        client:"Maria Clara Santos", clientPhone:"(19) 98765-4321", clientEmail:"mclaras@email.com",   city:"Campinas",         state:"SP", type:"Regularização fundiária",      area:88,   urgency:"media", situation:"Posse de fato há 12 anos. Sem escritura formal. Quer vender o imóvel." },
  { id:"p3", name:"Sítio Santa Luzia",            client:"João Pereira Neto",  clientPhone:"(14) 99876-5432", clientEmail:"joao.neto@email.com", city:"Bauru",            state:"SP", type:"Georreferenciamento rural",    area:4500, urgency:"baixa", situation:"CCIR desatualizado. Precisa de laudo georreferenciado para herança." },
  { id:"p4", name:"Sobrado Vila Nova",            client:"Cláudia Fernandes",  clientPhone:"(11) 97654-3210", clientEmail:"claudia.f@email.com", city:"São Bernardo",     state:"SP", type:"Regularização de construção",  area:220,  urgency:"alta",  situation:"Ampliação não aprovada. Prefeitura notificou para regularizar em 60 dias." },
  { id:"p5", name:"Casa Parque das Flores",       client:"Anderson Lima",      clientPhone:"(16) 98543-2109", clientEmail:"a.lima@email.com",    city:"Ribeirão Preto",   state:"SP", type:"Averbação de demolição",       area:95,   urgency:"media", situation:"Demolição de galpão não averbada. Venda do lote pendente do processo." },
  { id:"p6", name:"Galpão Industrial ZN",         client:"TechLog Transportes",clientPhone:"(11) 3245-6789",  clientEmail:"juridico@techlog.com",city:"São Paulo",        state:"SP", type:"Regularização empresarial",   area:1800, urgency:"alta",  situation:"Alvará de funcionamento bloqueado por irregularidade. Prejuízo diário." },
  { id:"p7", name:"Apartamento Beira Mar",        client:"Solange Tavares",    clientPhone:"(13) 99345-6789", clientEmail:"sol.tav@email.com",   city:"Santos",           state:"SP", type:"Regularização de área",        area:67,   urgency:"baixa", situation:"Área do imóvel divergente da matrícula em 8m². Inventário aguardando." },
  { id:"p8", name:"Chácara Horizonte Verde",      client:"Marcos Vinício",     clientPhone:"(17) 99876-1234", clientEmail:"mv.chacara@email.com",city:"Rio Preto",        state:"SP", type:"Usucapião rural",              area:2200, urgency:"media", situation:"Ocupação há 22 anos sem documentação formal. Três famílias envolvidas." },
  { id:"p9", name:"Terreno Condomínio Fechado",   client:"Patrícia Gomes",     clientPhone:"(11) 91234-5678", clientEmail:"patricia.g@email.com",city:"Alphaville",       state:"SP", type:"Desdobramento de lote",        area:360,  urgency:"baixa", situation:"Lote a ser subdividido entre herdeiros conforme partilha judicial." },
];

const STAGE_DEFS: StageDef[] = [
  {
    num: 1, label: "Análise documental",
    desc: "Receba e confira todos os documentos do caso antes de avançar.",
    fields: [
      { id:"docs_recebidos", label:"Documentos recebidos", type:"checklist", options:["IPTU atualizado","Escritura / matrícula","RG e CPF do proprietário","Planta do imóvel","CCIR / CAR (rural)","Habite-se (se houver)"] },
      { id:"pendencias",    label:"Pendências ou inconsistências", type:"textarea", placeholder:"Descreva documentos ausentes, dados divergentes ou outras observações relevantes para este caso..." },
      { id:"obs_inicial",   label:"Situação geral — resumo inicial", type:"text",     placeholder:"Resumo do estado da documentação ao receber o caso" },
    ],
  },
  {
    num: 2, label: "Vistoria técnica",
    desc: "Visite o imóvel e registre o levantamento técnico.",
    fields: [
      { id:"data_vistoria",   label:"Data da vistoria",                      type:"date" },
      { id:"area_levantada",  label:"Área verificada no local (m²)",         type:"number",   placeholder:"ex: 145.00" },
      { id:"tipo_irr",        label:"Tipo de irregularidade principal",       type:"select",   options:["Construção não averbada","Área maior que escritura","Área menor que escritura","Sem habite-se","Subdivisão não registrada","Uso divergente","Outro"] },
      { id:"irregularidades", label:"Irregularidades detalhadas",             type:"textarea", placeholder:"Descreva o que foi encontrado na vistoria..." },
    ],
  },
  {
    num: 3, label: "Projeto e ART / RRT",
    desc: "Elabore o projeto técnico e emita a ART ou RRT correspondente.",
    fields: [
      { id:"tipo_servico",  label:"Tipo de serviço técnico",                      type:"select",  options:["Projeto de regularização","Projeto de averbação","Laudo técnico de vistoria","Planta de subdivisão","Projeto de desmembramento"] },
      { id:"art_numero",    label:"N° da ART / RRT",                              type:"text",    placeholder:"ex: 2026AT000123" },
      { id:"resp_tecnico",  label:"Responsável técnico (nome + CREA/CAU/OAB)",    type:"text",    placeholder:"ex: Carla Rocha — CREA/SP 123456" },
      { id:"link_projeto",  label:"Link do projeto (Drive / OneDrive / Dropbox)", type:"text",    placeholder:"https://..." },
    ],
  },
  {
    num: 4, label: "Protocolo e tramitação",
    desc: "Protocole nos órgãos competentes e acompanhe a tramitação.",
    fields: [
      { id:"orgao",            label:"Órgão de protocolo",       type:"select",   options:["Prefeitura Municipal","Cartório de Registro de Imóveis","Receita Federal","INCRA","SPU","Outro"] },
      { id:"num_protocolo",    label:"Número do protocolo",      type:"text",     placeholder:"ex: PREF-2026-004567" },
      { id:"data_entrada",     label:"Data de entrada",          type:"date" },
      { id:"previsao_retorno", label:"Previsão de resposta",     type:"date" },
      { id:"obs_tramite",      label:"Observações da tramitação",type:"textarea", placeholder:"Status atual, contatos realizados, pendências do órgão..." },
    ],
  },
  {
    num: 5, label: "Conclusão e entrega",
    desc: "Entregue os documentos finalizados ao cliente e encerre o processo.",
    fields: [
      { id:"docs_entregues",  label:"Documentos entregues ao cliente",       type:"checklist", options:["Certidão de regularização","Escritura atualizada","IPTU corrigido","ART / RRT registrada","Cópia do processo","Habite-se"] },
      { id:"obs_finais",      label:"Observações finais",                    type:"textarea",  placeholder:"Resumo da conclusão, pendências do cliente, observações..." },
      { id:"cliente_ciente",  label:"Confirmação de encerramento",           type:"checkbox",  checkLabel:"Confirmo que o cliente recebeu os documentos e assinou o encerramento do processo" },
    ],
  },
];

/* ─────────────────────────────────────────────── Styles */
const URGENCY_LABEL: Record<Urgency, string> = { alta:"Urgente", media:"Média", baixa:"Baixa" };
const URGENCY_CLS: Record<Urgency, string>   = {
  alta:  "bg-red-50 text-red-600 ring-1 ring-red-200",
  media: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  baixa: "bg-green-50 text-green-700 ring-1 ring-green-200",
};

/* ─────────────────────────────────────────────── Storage helpers */
function storeGet<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
function storeSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}

/* ─────────────────────────────────────────────── Seed chat messages */
const SEED_MSGS: Record<string, LocalMsg[]> = {
  p1: [
    { id:"sm1", text:"Olá! Vi que o processo foi atribuído. Quais documentos preciso separar?", isClient:true,  sender:"Roberto Alves", ts: new Date(Date.now()-86_400_000).toISOString() },
    { id:"sm2", text:"Boa tarde, Roberto! Preciso do IPTU atualizado, cópia da escritura e RG/CPF. Pode digitalizar e enviar por aqui.", isClient:false, sender:PROF_NAME,      ts: new Date(Date.now()-82_800_000).toISOString() },
    { id:"sm3", text:"Entendido! Vou digitalizar ainda hoje.", isClient:true,  sender:"Roberto Alves", ts: new Date(Date.now()-79_200_000).toISOString() },
  ],
  p2: [
    { id:"sm4", text:"Minha situação é complicada — já tentei regularizar antes e não consegui.", isClient:true, sender:"Maria Clara", ts: new Date(Date.now()-172_800_000).toISOString() },
    { id:"sm5", text:"Entendo, Maria Clara. Esse tipo de caso é comum e tem solução. Me conta mais sobre a tentativa anterior para a gente começar do ponto certo.", isClient:false, sender:PROF_NAME, ts: new Date(Date.now()-169_200_000).toISOString() },
  ],
};

/* ─────────────────────────────────────────────── Component */
function ProfissionalPage() {
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState(1);
  const [rightTab,    setRightTab]    = useState<RightTab>("chat");
  const [chatInput,   setChatInput]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  /* ── Persistent state ── */
  const [acceptedIds, setAcceptedIds] = useState<string[]>(
    () => storeGet<string[]>("rz-accepted-procs", ["p1", "p2"])
  );
  const [doneStages, setDoneStages] = useState<Record<string, number[]>>(
    () => storeGet("rz-done-stages", {})
  );
  const [allFields, setAllFields] = useState<Record<string, Record<number, Record<string, FieldVal>>>>(
    () => storeGet("rz-stage-fields", {})
  );
  const [allMsgs, setAllMsgs] = useState<Record<string, LocalMsg[]>>(
    () => storeGet("rz-prof-msgs", SEED_MSGS)
  );
  const [allDocs, setAllDocs] = useState<Record<string, LocalDoc[]>>(
    () => storeGet("rz-prof-docs", {})
  );
  /* ── Notification tracking ── */
  const [lastChatView, setLastChatView] = useState<Record<string, number>>(
    () => storeGet("rz-last-chat-view", {})
  );
  /* ── Private notes per process ── */
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>(
    () => storeGet("rz-private-notes", {})
  );
  const [noteInput, setNoteInput] = useState("");

  /* ── Derived ── */
  const selectedProc  = MOCK_PROCESSES.find((p) => p.id === selectedId) ?? null;
  const myProcs       = MOCK_PROCESSES.filter((p) =>  acceptedIds.includes(p.id));
  const availProcs    = MOCK_PROCESSES.filter((p) => !acceptedIds.includes(p.id));
  const msgs          = selectedId ? (allMsgs[selectedId] ?? []) : [];
  const docs          = selectedId ? (allDocs[selectedId] ?? []) : [];
  const stageDef      = STAGE_DEFS.find((s) => s.num === activeStage) ?? STAGE_DEFS[0];

  /* ── Unread counts ── */
  const unreadCount = (pid: string) => {
    const lastView = lastChatView[pid] ?? 0;
    return (allMsgs[pid] ?? []).filter(
      (m) => m.isClient && new Date(m.ts).getTime() > lastView
    ).length;
  };
  const totalUnread = acceptedIds.reduce((sum, pid) => sum + unreadCount(pid), 0);

  const markChatRead = (pid: string) => {
    const now = Date.now();
    setLastChatView((prev) => {
      const next = { ...prev, [pid]: now };
      storeSet("rz-last-chat-view", next);
      return next;
    });
  };

  const isDone     = (pid: string, n: number) => (doneStages[pid] ?? []).includes(n);
  const isActiveStg = (pid: string, n: number) => {
    const done = doneStages[pid] ?? [];
    const maxDone = done.length > 0 ? Math.max(...done) : 0;
    return n === maxDone + 1 && !done.includes(n);
  };
  const currentStage = (pid: string) => {
    const done = doneStages[pid] ?? [];
    for (let i = 1; i <= 5; i++) if (!done.includes(i)) return i;
    return 5;
  };
  const progress = (pid: string) =>
    Math.round(((doneStages[pid] ?? []).length / 5) * 100);

  /* ── Field helpers ── */
  const getField = (pid: string, stageNum: number, fid: string): FieldVal =>
    allFields[pid]?.[stageNum]?.[fid] ?? "";

  const setField = (pid: string, stageNum: number, fid: string, val: FieldVal) => {
    setAllFields((prev) => {
      const next = {
        ...prev,
        [pid]: {
          ...prev[pid],
          [stageNum]: { ...prev[pid]?.[stageNum], [fid]: val },
        },
      };
      storeSet("rz-stage-fields", next);
      return next;
    });
  };

  const hasAnyField = (pid: string, stageNum: number) => {
    const fields = allFields[pid]?.[stageNum] ?? {};
    return Object.values(fields).some((v) => {
      if (typeof v === "string")  return v.trim().length > 0;
      if (Array.isArray(v))       return v.length > 0;
      if (typeof v === "boolean") return v;
      return false;
    });
  };

  /* ── Actions ── */
  const completeStage = (pid: string, n: number) => {
    setDoneStages((prev) => {
      const next = { ...prev, [pid]: [...(prev[pid] ?? []).filter((x) => x !== n), n] };
      storeSet("rz-done-stages", next);
      return next;
    });
    if (n < 5) setActiveStage(n + 1);
  };

  const undoStage = (pid: string, n: number) => {
    setDoneStages((prev) => {
      const next = { ...prev, [pid]: (prev[pid] ?? []).filter((x) => x !== n) };
      storeSet("rz-done-stages", next);
      return next;
    });
  };

  const acceptProcess = (pid: string) => {
    const next = [...acceptedIds, pid];
    setAcceptedIds(next);
    storeSet("rz-accepted-procs", next);
    setSelectedId(pid);
    setActiveStage(1);
    setRightTab("briefing");
  };

  const openProcess = (pid: string) => {
    setSelectedId(pid);
    setActiveStage(currentStage(pid));
    setRightTab("briefing");
  };

  const sendMsg = (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !selectedId) return;
    const pid = selectedId;
    const msg: LocalMsg = {
      id: crypto.randomUUID(),
      text, isClient: false, sender: PROF_NAME,
      ts: new Date().toISOString(),
    };
    setAllMsgs((prev) => {
      const next = { ...prev, [pid]: [...(prev[pid] ?? []), msg] };
      storeSet("rz-prof-msgs", next);
      return next;
    });
    setChatInput("");
    setTimeout(() => chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);

    /* Simula resposta automática do cliente após 4s */
    const proc = MOCK_PROCESSES.find((p) => p.id === pid);
    const autoReplies = [
      "Entendido! Vou providenciar.",
      "Certo, obrigado pela informação!",
      "Ok, já estou separando os documentos.",
      "Perfeito, aguardo a próxima atualização.",
    ];
    if (proc) {
      setTimeout(() => {
        const reply: LocalMsg = {
          id: crypto.randomUUID(),
          text: autoReplies[Math.floor(Math.random() * autoReplies.length)],
          isClient: true,
          sender: proc.client,
          ts: new Date().toISOString(),
        };
        setAllMsgs((prev) => {
          const next = { ...prev, [pid]: [...(prev[pid] ?? []), reply] };
          storeSet("rz-prof-msgs", next);
          return next;
        });
        /* Browser notification se permitido */
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`Mensagem de ${proc.client}`, {
            body: reply.text,
            icon: "/logo-ato.png",
          });
        }
        setTimeout(() => chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
      }, 4000);
    }
  };

  const uploadDocs = (files: FileList | null) => {
    if (!files || !selectedId) return;
    const nd: LocalDoc[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      ts: new Date().toISOString(),
      status: "Enviado" as const,
      by: "prof" as const,
    }));
    setAllDocs((prev) => {
      const next = { ...prev, [selectedId]: [...(prev[selectedId] ?? []), ...nd] };
      storeSet("rz-prof-docs", next);
      return next;
    });
  };

  /* ── Field renderer ── */
  const renderField = (field: FieldDef) => {
    if (!selectedId) return null;
    const val = getField(selectedId, activeStage, field.id);
    const set = (v: FieldVal) => setField(selectedId, activeStage, field.id, v);
    const base =
      "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none " +
      "focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 transition-colors " +
      "placeholder:text-ink-soft/50";

    switch (field.type) {
      case "text":
        return <input type="text" value={val as string} onChange={(e) => set(e.target.value)} placeholder={field.placeholder} className={base} />;
      case "number":
        return <input type="number" value={val as string} onChange={(e) => set(e.target.value)} placeholder={field.placeholder} className={base} />;
      case "date":
        return <input type="date" value={val as string} onChange={(e) => set(e.target.value)} className={base} />;
      case "textarea":
        return <textarea value={val as string} onChange={(e) => set(e.target.value)} placeholder={field.placeholder} rows={3} className={`${base} resize-none`} />;
      case "select":
        return (
          <select value={val as string} onChange={(e) => set(e.target.value)} className={`${base} cursor-pointer`}>
            <option value="">Selecione...</option>
            {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "checklist": {
        const arr = (val as string[]) || [];
        return (
          <div className="space-y-1.5">
            {field.options?.map((opt) => {
              const checked = arr.includes(opt);
              return (
                <label key={opt}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-surface px-3 py-2 hover:bg-surface-elevated transition-colors"
                  onClick={() => set(checked ? arr.filter((v) => v !== opt) : [...arr, opt])}
                >
                  <div className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${checked ? "bg-foreground border-foreground" : "border-border bg-background"}`}>
                    {checked && <Check className="h-3 w-3 text-background" />}
                  </div>
                  <span className="text-sm">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      }
      case "checkbox": {
        const bv = val as boolean;
        return (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            onClick={() => set(!bv)}
          >
            <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${bv ? "bg-foreground border-foreground" : "border-border bg-background"}`}>
              {bv && <Check className="h-3.5 w-3.5 text-background" />}
            </div>
            <span className="text-sm leading-relaxed">{field.checkLabel}</span>
          </label>
        );
      }
      default: return null;
    }
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-surface/50 text-foreground">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          {selectedProc ? (
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Processos</span>
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-1.5">
              <img src="/logo-ato.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
              <span className="font-arsenica text-xl leading-none text-accent hidden sm:inline">ato</span>
            </Link>
          )}

          {selectedProc ? (
            <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
              <span className="font-medium truncate max-w-[220px]">{selectedProc.name}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${URGENCY_CLS[selectedProc.urgency]}`}>
                {URGENCY_LABEL[selectedProc.urgency]}
              </span>
            </div>
          ) : (
            <>
              <div className="h-5 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-ink-soft" />
                <span className="font-medium">Painel do Profissional</span>
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                /* Pedir permissão de notificação ao clicar no sino */
                if (typeof Notification !== "undefined" && Notification.permission === "default") {
                  Notification.requestPermission();
                }
                /* Ir para o processo com mais não-lidos */
                const withUnread = acceptedIds
                  .map((pid) => ({ pid, count: unreadCount(pid) }))
                  .filter((x) => x.count > 0)
                  .sort((a, b) => b.count - a.count);
                if (withUnread.length > 0) {
                  openProcess(withUnread[0].pid);
                  setTimeout(() => {
                    setRightTab("chat");
                    markChatRead(withUnread[0].pid);
                  }, 50);
                }
              }}
              className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated"
            >
              <Bell className="h-4 w-4 text-ink-soft" />
              {totalUnread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </button>
            <Link
              to="/perfil-profissional"
              className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              {PROF_INITIALS}
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* ═══════════════════════════════ LIST VIEW */}
        {!selectedProc ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"
          >
            {/* Meus processos */}
            <section className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-soft">Em andamento</div>
                  <h2 className="font-serif text-2xl tracking-tight">Meus processos</h2>
                </div>
                <span className="text-xs text-ink-soft">{myProcs.length} processo{myProcs.length !== 1 ? "s" : ""}</span>
              </div>
              {myProcs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-soft">
                  Você ainda não aceitou nenhum caso. Veja os disponíveis abaixo.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myProcs.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openProcess(p.id)}
                      className="group rounded-2xl bg-background ring-1 ring-border p-4 text-left hover:ring-foreground/30 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${URGENCY_CLS[p.urgency]}`}>
                          {URGENCY_LABEL[p.urgency]}
                        </span>
                      </div>
                      <div className="text-sm font-medium leading-tight">{p.name}</div>
                      <div className="mt-0.5 text-xs text-ink-soft">{p.type}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                        <MapPin className="h-3 w-3" />{p.city}/{p.state}
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
                          <span>Etapa {currentStage(p.id)} de 5</span>
                          <span>{progress(p.id)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress(p.id)}%` }} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.client}</span>
                        <span className="text-foreground group-hover:underline">Abrir →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Casos disponíveis */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-soft">Novos para aceitar</div>
                  <h2 className="font-serif text-2xl tracking-tight">Casos disponíveis</h2>
                </div>
                <span className="text-xs text-ink-soft">{availProcs.length} caso{availProcs.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {availProcs.map((p) => (
                  <div key={p.id} className="rounded-2xl bg-background ring-1 ring-border p-4 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-border text-ink-soft">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${URGENCY_CLS[p.urgency]}`}>
                        {URGENCY_LABEL[p.urgency]}
                      </span>
                    </div>
                    <div className="font-medium leading-tight">{p.name}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{p.type}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                      <MapPin className="h-3 w-3" />{p.city}/{p.state} · {p.area.toLocaleString("pt-BR")}m²
                    </div>
                    <p className="mt-2 text-xs text-ink-soft line-clamp-2 leading-relaxed">{p.situation}</p>
                    <button
                      onClick={() => acceptProcess(p.id)}
                      className="mt-3 w-full rounded-xl bg-foreground py-2 text-xs text-background hover:bg-foreground/90 transition-colors"
                    >
                      Aceitar caso
                    </button>
                  </div>
                ))}
                {availProcs.length === 0 && (
                  <div className="col-span-full py-8 text-center text-sm text-ink-soft">
                    Nenhum caso disponível no momento.
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        ) : (
          /* ═══════════════════════════════ WORK VIEW (3 columns) */
          <motion.div
            key={`work-${selectedId}`}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="grid h-[calc(100vh-3.5rem)] grid-cols-[210px_1fr_272px] overflow-hidden"
          >
            {/* ── COL 1: Stage list ── */}
            <aside className="flex flex-col overflow-hidden border-r border-border bg-background">
              <div className="border-b border-border p-4">
                <div className="text-[10px] uppercase tracking-widest text-ink-soft">Progresso</div>
                <div className="mt-1 font-serif text-base leading-tight tracking-tight line-clamp-2">
                  {selectedProc.name}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
                  <span>{(doneStages[selectedId!] ?? []).length} / 5 etapas</span>
                  <span>{progress(selectedId!)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                  <motion.div
                    animate={{ width: `${progress(selectedId!)}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-accent"
                  />
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {STAGE_DEFS.map((s) => {
                  const done   = isDone(selectedId!, s.num);
                  const active = s.num === activeStage;
                  return (
                    <button
                      key={s.num}
                      onClick={() => setActiveStage(s.num)}
                      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-foreground text-background" : "hover:bg-surface"
                      }`}
                    >
                      <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium ${
                        done
                          ? active ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent"
                          : active ? "bg-background/20 text-background" : "bg-surface text-ink-soft ring-1 ring-border"
                      }`}>
                        {done ? <Check className="h-3.5 w-3.5" /> : s.num}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium leading-tight">{s.label}</div>
                        <div className={`mt-0.5 text-[11px] ${active ? "text-background/60" : "text-ink-soft"}`}>
                          {done ? "Concluída" : isActiveStg(selectedId!, s.num) ? "Em andamento" : "Aguardando"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* ── COL 2: Stage form + upload ── */}
            <main className="flex flex-col overflow-hidden bg-surface/30">
              <div className="flex-1 overflow-y-auto p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`stage-${activeStage}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Stage header */}
                    <div className="mb-5 flex items-start gap-3">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-medium ${
                        isDone(selectedId!, activeStage) ? "bg-accent text-accent-foreground" : "bg-foreground text-background"
                      }`}>
                        {isDone(selectedId!, activeStage) ? <Check className="h-4 w-4" /> : stageDef.num}
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Etapa {stageDef.num}</div>
                        <h2 className="font-serif text-xl tracking-tight leading-none">{stageDef.label}</h2>
                        <p className="mt-1 text-sm text-ink-soft">{stageDef.desc}</p>
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="space-y-4">
                      {stageDef.fields.map((field) => (
                        <div key={field.id}>
                          <label className="mb-1.5 block text-sm font-medium">{field.label}</label>
                          {renderField(field)}
                        </div>
                      ))}
                    </div>

                    {/* Upload area */}
                    <div className="mt-6">
                      <div className="mb-2 text-sm font-medium">Arquivos desta etapa</div>
                      <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); uploadDocs(e.dataTransfer.files); }}
                        className="cursor-pointer rounded-2xl border-2 border-dashed border-border bg-background p-5 text-center transition-colors hover:border-foreground/30 hover:bg-surface"
                      >
                        <Upload className="mx-auto h-6 w-6 text-ink-soft" />
                        <div className="mt-2 text-sm text-ink-soft">
                          Arraste ou <span className="text-foreground underline">clique para enviar</span>
                        </div>
                        <div className="mt-1 text-xs text-ink-soft/60">PDF, DWG, JPG, PNG, DOC — máx. 25 MB</div>
                      </div>
                      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => uploadDocs(e.target.files)} />
                    </div>

                    {/* Last uploaded docs */}
                    {docs.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {docs.slice(-4).map((d) => (
                          <div key={d.id} className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 ring-1 ring-border text-sm">
                            <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
                            <span className="flex-1 truncate text-sm">{d.name}</span>
                            <span className="text-xs text-ink-soft">{d.size}</span>
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{d.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom bar — complete / undo */}
              <div className="border-t border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  {isDone(selectedId!, activeStage) ? (
                    <>
                      <div className="flex flex-1 items-center gap-2 text-sm text-accent">
                        <CheckCircle2 className="h-4 w-4" />
                        Etapa {activeStage} concluída
                      </div>
                      <button
                        onClick={() => undoStage(selectedId!, activeStage)}
                        className="rounded-full border border-border px-4 py-2 text-xs text-ink-soft hover:bg-surface hover:border-foreground/30 transition-colors"
                      >
                        ↩ Desfazer
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="flex-1 text-xs text-ink-soft">
                        {hasAnyField(selectedId!, activeStage)
                          ? "Pronto para concluir esta etapa."
                          : "Preencha pelo menos um campo para habilitar."}
                      </p>
                      <button
                        onClick={() => completeStage(selectedId!, activeStage)}
                        disabled={!hasAnyField(selectedId!, activeStage)}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Concluir etapa {activeStage}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </main>

            {/* ── COL 3: Client + Docs/Chat ── */}
            <aside className="flex flex-col overflow-hidden border-l border-border bg-background">
              {/* Client card */}
              <div className="shrink-0 border-b border-border p-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-background text-xs font-medium">
                    {selectedProc.client.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{selectedProc.client}</div>
                    <div className="text-xs text-ink-soft truncate">{selectedProc.clientEmail}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${URGENCY_CLS[selectedProc.urgency]}`}>
                    {URGENCY_LABEL[selectedProc.urgency]}
                  </span>
                </div>
                <div className="mt-2.5 space-y-1 text-xs text-ink-soft">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {selectedProc.city} · {selectedProc.state}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {selectedProc.type} · {selectedProc.area.toLocaleString("pt-BR")}m²
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-soft/80 leading-relaxed line-clamp-2">
                  {selectedProc.situation}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex shrink-0 border-b border-border">
                <button
                  onClick={() => setRightTab("briefing")}
                  className={`flex-1 py-2.5 text-xs transition-colors ${rightTab === "briefing" ? "border-b-2 border-foreground font-medium text-foreground" : "text-ink-soft hover:text-foreground"}`}
                >
                  <BookOpen className="inline-block h-3 w-3 mr-1" />Briefing
                </button>
                <button
                  onClick={() => setRightTab("docs")}
                  className={`flex-1 py-2.5 text-xs transition-colors ${rightTab === "docs" ? "border-b-2 border-foreground font-medium text-foreground" : "text-ink-soft hover:text-foreground"}`}
                >
                  <FileText className="inline-block h-3 w-3 mr-1" />Docs ({docs.length})
                </button>
                <button
                  onClick={() => {
                    setRightTab("chat");
                    if (selectedId) markChatRead(selectedId);
                  }}
                  className={`relative flex-1 py-2.5 text-xs transition-colors ${rightTab === "chat" ? "border-b-2 border-foreground font-medium text-foreground" : "text-ink-soft hover:text-foreground"}`}
                >
                  <MessageSquare className="inline-block h-3 w-3 mr-1" />Chat ({msgs.length})
                  {selectedId && unreadCount(selectedId) > 0 && (
                    <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                      {unreadCount(selectedId)}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab: Briefing */}
              {rightTab === "briefing" && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Client situation */}
                  <div className="rounded-xl bg-surface p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-soft">
                      <AlertTriangle className="h-3 w-3" /> Situação relatada
                    </div>
                    <p className="text-xs leading-relaxed">{selectedProc?.situation}</p>
                  </div>

                  {/* Property details */}
                  <div className="rounded-xl bg-surface p-3 space-y-1.5">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-ink-soft">Dados do imóvel</div>
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span>{selectedProc?.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{selectedProc?.city} · {selectedProc?.state}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <span className="h-3 w-3 shrink-0 text-center text-[10px]">m²</span>
                      <span>{selectedProc?.area.toLocaleString("pt-BR")} m²</span>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="rounded-xl bg-surface p-3 space-y-1.5">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-ink-soft">Contato</div>
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{selectedProc?.clientPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{selectedProc?.clientEmail}</span>
                    </div>
                  </div>

                  {/* Timeline / stage progress */}
                  <div className="rounded-xl bg-surface p-3">
                    <div className="mb-2 text-[10px] uppercase tracking-widest text-ink-soft">Progresso</div>
                    <div className="space-y-1.5">
                      {STAGE_DEFS.map((s) => {
                        const done = selectedId ? isDone(selectedId!, s.num) : false;
                        const active = s.num === activeStage && !done;
                        return (
                          <div key={s.num} className="flex items-center gap-2 text-xs">
                            <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-medium ${
                              done ? "bg-accent/15 text-accent" : active ? "bg-foreground text-background" : "bg-background ring-1 ring-border text-ink-soft"
                            }`}>
                              {done ? <Check className="h-3 w-3" /> : s.num}
                            </div>
                            <span className={done ? "text-foreground" : "text-ink-soft"}>{s.label}</span>
                            {done && <span className="ml-auto text-[10px] text-accent">✓</span>}
                            {active && <span className="ml-auto text-[10px] text-ink-soft">em andamento</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Private notes */}
                  <div className="rounded-xl bg-surface p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-soft">
                      <StickyNote className="h-3 w-3" /> Notas privadas
                    </div>
                    {selectedId && privateNotes[selectedId] && (
                      <p className="mb-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                        {privateNotes[selectedId]}
                      </p>
                    )}
                    <textarea
                      rows={3}
                      placeholder="Anotações internas, próximos passos, observações..."
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none resize-none focus:border-foreground/30 placeholder:text-ink-soft/50"
                    />
                    <button
                      onClick={() => {
                        if (!selectedId || !noteInput.trim()) return;
                        const combined = [
                          privateNotes[selectedId] ?? "",
                          noteInput.trim(),
                        ].filter(Boolean).join("\n\n");
                        setPrivateNotes((prev) => {
                          const next = { ...prev, [selectedId!]: combined };
                          storeSet("rz-private-notes", next);
                          return next;
                        });
                        setNoteInput("");
                      }}
                      disabled={!noteInput.trim()}
                      className="mt-1.5 w-full rounded-lg bg-foreground py-1.5 text-xs text-background disabled:opacity-40 hover:bg-foreground/90 transition-colors"
                    >
                      Salvar nota
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: Docs */}
              {rightTab === "docs" && (
                <div className="flex-1 overflow-y-auto p-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs text-ink-soft hover:bg-surface transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Enviar documento
                  </button>
                  {docs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-ink-soft">Nenhum documento ainda.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {docs.map((d) => (
                        <div key={d.id} className="rounded-xl bg-surface px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                            <span className="flex-1 truncate text-xs font-medium">{d.name}</span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-soft">
                            <span>{d.size}</span>
                            <span className={`rounded-full px-2 py-0.5 ${
                              d.status === "Aprovado" ? "bg-accent/10 text-accent" : "bg-background ring-1 ring-border"
                            }`}>
                              {d.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Chat */}
              {rightTab === "chat" && (
                <>
                  <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                    {msgs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-ink-soft">Sem mensagens ainda.</div>
                    ) : (
                      msgs.map((m) => (
                        <div key={m.id} className={`flex ${m.isClient ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                            m.isClient
                              ? "rounded-bl-md bg-surface text-foreground"
                              : "rounded-br-md bg-accent text-accent-foreground"
                          }`}>
                            {m.isClient && (
                              <div className="mb-0.5 text-[10px] font-medium opacity-60">{m.sender}</div>
                            )}
                            {m.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={sendMsg} className="flex shrink-0 items-center gap-2 border-t border-border p-3">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Mensagem para o cliente…"
                      className="flex-1 rounded-full bg-surface px-4 py-2 text-xs outline-none placeholder:text-ink-soft/60"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </>
              )}
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
