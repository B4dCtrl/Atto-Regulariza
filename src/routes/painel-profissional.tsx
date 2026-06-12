import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, useRef, useEffect, type FormEvent } from "react";
import {
  ArrowLeft, Bell, Briefcase, Building2, Check, CheckCircle2,
  ChevronRight, FileText, MapPin, MessageSquare, Plus,
  Send, Upload, User, BookOpen, StickyNote,
  AlertTriangle, Phone, Mail, BarChart3, Settings, LogOut, X, Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type PropertyRow = Tables<"properties">;

export const Route = createFileRoute("/painel-profissional")({
  head: () => ({
    meta: [
      { title: "Painel do Profissional — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: ProfissionalPage,
});

/* ─────────────────────────────────────────────── Types */
type Urgency = "alta" | "media" | "baixa";
type FieldType = "text" | "textarea" | "date" | "number" | "select" | "checklist" | "checkbox";
type FieldVal  = string | string[] | boolean;
type RightTab  = "docs" | "chat" | "briefing";
type MainSection = "processos" | "stats" | "notificacoes" | "configuracoes";

interface Pendency {
  id: string;
  stageNum: number;
  description: string;
  createdAt: string;
  status: "aberta" | "resolvida";
}

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

/* ─────────────────────────────────────────────── AI replies pool */
const AI_REPLIES: Record<string, string[]> = {
  default: [
    "Entendido! Vou providenciar o mais rápido possível.",
    "Certo, obrigado pela atualização!",
    "Ok, já estou separando os documentos.",
    "Perfeito, aguardo a próxima atualização.",
    "Tudo bem! Qualquer dúvida pode chamar aqui.",
  ],
  documento: [
    "Vou digitalizar e enviar ainda hoje.",
    "Entendido! Quais documentos exatamente você precisa?",
    "Já tenho esses documentos em mãos, envio até amanhã.",
    "Posso enviar por e-mail também ou só aqui no sistema?",
  ],
  prazo: [
    "Quanto tempo leva em média esse processo?",
    "Tem como agilizar? Estou com prazo apertado.",
    "Ok, vou aguardar dentro do prazo informado.",
  ],
  prefeitura: [
    "Precisa de algum documento meu para o protocolo?",
    "A prefeitura costuma demorar muito nessa etapa?",
    "Vou acompanhar pelo sistema então.",
  ],
};

function getAIReply(msgText: string): string {
  const t = msgText.toLowerCase();
  if (t.includes("document") || t.includes("arquivo") || t.includes("iptu") || t.includes("escritura")) {
    const pool = AI_REPLIES.documento;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (t.includes("prazo") || t.includes("dias") || t.includes("tempo") || t.includes("quando")) {
    const pool = AI_REPLIES.prazo;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (t.includes("prefeitura") || t.includes("protocolo") || t.includes("órgão")) {
    const pool = AI_REPLIES.prefeitura;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = AI_REPLIES.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ─────────────────────────────────────────────── Component */
/** Mapeia uma propriedade do Supabase para o formato usado pela UI do painel. */
function propToProc(p: PropertyRow): MockProcess {
  const urgency: Urgency =
    p.urgencia === "urgente" ? "alta" : p.urgencia === "sem_pressa" ? "baixa" : "media";
  return {
    id: p.id,
    name: p.name,
    client: p.client_name ?? "Cliente",
    clientPhone: p.client_phone ?? "—",
    clientEmail: p.client_email ?? "—",
    city: p.city ?? "—",
    state: p.state ?? "—",
    type: p.tipo_imovel ?? p.objetivo ?? "Regularização",
    area: 0,
    urgency,
    situation: p.situacao ?? p.notes ?? "—",
  };
}

function ProfissionalPage() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const [mainSection,  setMainSection]  = useState<MainSection>("processos");
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [activeStage,  setActiveStage]  = useState(1);
  const [rightTab,     setRightTab]     = useState<RightTab>("chat");
  const [chatInput,    setChatInput]    = useState("");
  const [pendencyInput,    setPendencyInput]    = useState("");
  const [showPendencyForm, setShowPendencyForm] = useState(false);
  const [showAvatarMenu,   setShowAvatarMenu]   = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  /* Fecha dropdown ao clicar fora */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /* ── Dados reais do Supabase ── */
  const [processes,   setProcesses]   = useState<MockProcess[]>([]);
  const [profProfile, setProfProfile] = useState<{ name: string; initials: string }>({
    name: "Profissional", initials: "··",
  });

  /* ── Estado de trabalho do profissional (localStorage, por processo real) ── */
  const [doneStages, setDoneStages] = useState<Record<string, number[]>>(
    () => storeGet("rz-done-stages", {})
  );
  const [allFields, setAllFields] = useState<Record<string, Record<number, Record<string, FieldVal>>>>(
    () => storeGet("rz-stage-fields", {})
  );
  /* Chat e docs agora vêm do Supabase (em memória, por processo selecionado) */
  const [allMsgs, setAllMsgs] = useState<Record<string, LocalMsg[]>>({});
  const [allDocs, setAllDocs] = useState<Record<string, LocalDoc[]>>({});
  const [allPendencies, setAllPendencies] = useState<Record<string, Pendency[]>>(
    () => storeGet("rz-pendencies", {})
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
  const acceptedIds   = processes.map((p) => p.id);
  const selectedProc  = processes.find((p) => p.id === selectedId) ?? null;
  const myProcs       = processes;
  const availProcs: MockProcess[] = [];
  const msgs          = selectedId ? (allMsgs[selectedId] ?? []) : [];
  const docs          = selectedId ? (allDocs[selectedId] ?? []) : [];
  const stageDef      = STAGE_DEFS.find((s) => s.num === activeStage) ?? STAGE_DEFS[0];

  /* ── Carrega processos atribuídos a este profissional + seu perfil ── */
  useEffect(() => {
    if (!userId) return;

    supabase.from("profiles").select("name, initials").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (data) setProfProfile({
          name: data.name ?? "Profissional",
          initials: data.initials ?? (data.name ? data.name.split(/\s+/).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "··"),
        });
      });

    function loadProcs() {
      supabase.from("properties").select("*")
        .eq("assigned_professional_id", userId)
        .order("updated_at", { ascending: false })
        .then(({ data }) => { if (data) setProcesses(data.map((p) => propToProc(p as PropertyRow))); });
    }
    loadProcs();

    const ch = supabase
      .channel(`prof-procs-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, loadProcs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  /* ── Carrega chat + docs do processo selecionado (Supabase + realtime) ── */
  useEffect(() => {
    if (!selectedId) return;
    const pid = selectedId;

    function loadMsgs() {
      supabase.from("messages").select("*").eq("property_id", pid).order("created_at")
        .then(({ data }) => {
          if (!data) return;
          setAllMsgs((prev) => ({
            ...prev,
            [pid]: data.map((m) => ({
              id: m.id, text: m.content, isClient: m.is_client,
              sender: m.sender_name, ts: m.created_at,
            })),
          }));
        });
    }
    function loadDocs() {
      supabase.from("documents").select("*").eq("property_id", pid).order("created_at")
        .then(({ data }) => {
          if (!data) return;
          setAllDocs((prev) => ({
            ...prev,
            [pid]: data.map((d) => ({
              id: d.id, name: d.name, size: d.size_text ?? "—",
              ts: d.created_at,
              status: (d.status as LocalDoc["status"]) ?? "Enviado",
              by: d.uploaded_by === userId ? "prof" : "client",
            })),
          }));
        });
    }
    loadMsgs();
    loadDocs();

    const ch = supabase
      .channel(`prof-detail-${pid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `property_id=eq.${pid}` }, loadMsgs)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `property_id=eq.${pid}` }, loadDocs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, userId]);

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

  /* Reflete o progresso do profissional na propriedade → o cliente vê em tempo real. */
  async function syncProgressToProperty(pid: string, doneArr: number[]) {
    const count = doneArr.length;
    const progressPct = Math.round((count / 5) * 100);
    const status =
      count >= 5 ? "entregue"
      : count >= 4 ? "prefeitura"
      : count >= 2 ? "profissional"
      : count >= 1 ? "analise"
      : "entrada";
    const clientStage = Math.min(count + 1, 5);
    await supabase.from("properties")
      .update({ status, progress: progressPct, current_stage: clientStage, updated_at: new Date().toISOString() })
      .eq("id", pid);
    // Espelha nas etapas do cliente (1..count concluídas, próxima ativa)
    for (let i = 1; i <= 5; i++) {
      await supabase.from("process_stages")
        .update({
          state: i <= count ? "done" : i === count + 1 ? "active" : "pending",
          completed_at: i <= count ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("property_id", pid).eq("stage_number", i);
    }
  }

  /* ── Actions ── */
  const completeStage = (pid: string, n: number) => {
    setDoneStages((prev) => {
      const arr = [...(prev[pid] ?? []).filter((x) => x !== n), n];
      const next = { ...prev, [pid]: arr };
      storeSet("rz-done-stages", next);
      syncProgressToProperty(pid, arr);
      return next;
    });
    if (n < 5) setActiveStage(n + 1);
  };

  const undoStage = (pid: string, n: number) => {
    setDoneStages((prev) => {
      const arr = (prev[pid] ?? []).filter((x) => x !== n);
      const next = { ...prev, [pid]: arr };
      storeSet("rz-done-stages", next);
      syncProgressToProperty(pid, arr);
      return next;
    });
  };

  const openPendencies = (pid: string, stageNum: number) =>
    (allPendencies[pid] ?? []).filter((p) => p.stageNum === stageNum && p.status === "aberta");

  const hasOpenPendencies = (pid: string, stageNum: number) =>
    openPendencies(pid, stageNum).length > 0;

  const createPendency = (pid: string, stageNum: number, desc: string) => {
    if (!desc.trim()) return;
    const p: Pendency = { id: crypto.randomUUID(), stageNum, description: desc.trim(), createdAt: new Date().toISOString(), status: "aberta" };
    setAllPendencies((prev) => { const next = { ...prev, [pid]: [...(prev[pid] ?? []), p] }; storeSet("rz-pendencies", next); return next; });
    setPendencyInput("");
    setShowPendencyForm(false);
  };

  const resolvePendency = (pid: string, id: string) => {
    setAllPendencies((prev) => {
      const next = { ...prev, [pid]: (prev[pid] ?? []).map((p) => p.id === id ? { ...p, status: "resolvida" as const } : p) };
      storeSet("rz-pendencies", next);
      return next;
    });
  };

  // Admin atribui diretamente — não há mais "aceitar". Recusar devolve ao admin.
  // Usa RPC SECURITY DEFINER (a policy de update não permite o profissional se remover).
  const declineProcess = async (pid: string) => {
    await supabase.rpc("decline_property" as never, { _property_id: pid } as never);
    setProcesses((prev) => prev.filter((p) => p.id !== pid));
    setSelectedId(null);
  };

  const openProcess = (pid: string) => {
    setSelectedId(pid);
    setActiveStage(currentStage(pid));
    setRightTab("briefing");
  };

  const sendMsg = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !selectedId) return;
    const pid = selectedId;
    setChatInput("");
    await supabase.from("messages").insert({
      property_id: pid,
      sender_id: userId,
      sender_name: profProfile.name,
      content: text,
      is_client: false,
    });
    // realtime recarrega; rola para o fim
    setTimeout(() => chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 200);
  };

  const uploadDocs = async (files: FileList | null) => {
    if (!files || !selectedId) return;
    const pid = selectedId;
    const rows = Array.from(files).map((f) => ({
      property_id: pid,
      name: f.name,
      size_text: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      status: "Enviado",
      uploaded_by: userId,
    }));
    await supabase.from("documents").insert(rows);
    // realtime recarrega a lista
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
    <div className="flex h-screen overflow-hidden bg-surface/50 text-foreground">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="group sticky top-0 hidden h-screen w-16 shrink-0 md:block">
        <div className="absolute inset-y-0 left-0 z-20 flex h-full w-16 flex-col overflow-hidden border-r border-border bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]">
            {/* Logo */}
            <Link to="/painel-profissional" className="mb-5 flex shrink-0 items-center gap-2.5 px-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <img src="/logo-ato.png" alt="Ato" className="h-5 w-5 shrink-0 rounded" />
              <span className="whitespace-nowrap font-arsenica text-lg leading-none text-accent">ato</span>
            </Link>
            <nav className="space-y-0.5">
              {([
                { id: "processos", label: "Meus processos", icon: Briefcase },
                { id: "stats",     label: "Estatísticas",   icon: BarChart3  },
                { id: "notificacoes", label: "Notificações",icon: Bell       },
              ] as { id: MainSection; label: string; icon: React.ElementType }[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setMainSection(item.id); setSelectedId(null); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${mainSection === item.id ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-6">
              <div className="px-3 pb-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Conta</span>
              </div>
              <nav className="space-y-0.5">
                <Link
                  to="/perfil-profissional"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface transition-colors"
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Meu Perfil</span>
                </Link>
                <button
                  onClick={() => { setMainSection("configuracoes"); setSelectedId(null); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${mainSection === "configuracoes" ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"}`}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Configurações</span>
                </button>
              </nav>
            </div>
            <div className="mt-auto space-y-0.5">
              {/* Sino no sidebar */}
              <button
                onClick={() => {
                  if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
                  const withUnread = acceptedIds.map((pid) => ({ pid, count: unreadCount(pid) })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
                  if (withUnread.length > 0) { openProcess(withUnread[0].pid); setTimeout(() => { setRightTab("chat"); markChatRead(withUnread[0].pid); }, 50); }
                  else { setMainSection("notificacoes"); setSelectedId(null); }
                }}
                className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface transition-colors"
              >
                <Bell className="h-4 w-4 shrink-0" />
                {totalUnread > 0 && <span className="absolute left-6 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Notificações {totalUnread > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{totalUnread}</span>}
                </span>
              </button>
              <button
                onClick={() => { window.location.href = "/entrar"; }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Sair</span>
              </button>
              {/* Avatar */}
              <div ref={avatarRef} className="relative">
                <button
                  onClick={() => setShowAvatarMenu((v) => !v)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface transition-colors"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-medium text-background">
                    {profProfile.initials}
                  </div>
                  <div className="min-w-0 text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="truncate text-xs font-medium whitespace-nowrap">{profProfile.name}</div>
                    <div className="truncate text-[11px] text-ink-soft whitespace-nowrap">Profissional</div>
                  </div>
                </button>
                {showAvatarMenu && (
                  <div className="absolute bottom-12 left-2 z-50 w-48 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                    <div className="p-1.5 space-y-0.5">
                      <button onClick={() => { setShowAvatarMenu(false); navigate({ to: "/perfil-profissional" }); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-surface transition-colors">
                        <User className="h-4 w-4" /> Meu Perfil
                      </button>
                      <button onClick={() => { setShowAvatarMenu(false); setMainSection("configuracoes"); setSelectedId(null); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-surface transition-colors">
                        <Settings className="h-4 w-4" /> Configurações
                      </button>
                      <div className="my-1 h-px bg-border" />
                      <button onClick={() => { setShowAvatarMenu(false); window.location.href = "/entrar"; }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <LogOut className="h-4 w-4" /> Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ── PROCESSOS: lista ── */}
            {mainSection === "processos" && !selectedProc && (
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
                  Nenhum processo atribuído a você ainda. A equipe designa os casos conforme sua
                  especialização — eles aparecem aqui automaticamente.
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

          </motion.div>
            )}

            {/* ── ESTATÍSTICAS ── */}
            {mainSection === "stats" && (
              <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
                <div className="mb-8">
                  <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão</div>
                  <h2 className="font-serif text-2xl tracking-tight">Estatísticas</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Total de casos",  value: myProcs.length,                                                                                               icon: Briefcase     },
                    { label: "Concluídos",       value: myProcs.filter((p) => (doneStages[p.id] ?? []).length === 5).length,                                         icon: CheckCircle2  },
                    { label: "Em progresso",     value: myProcs.filter((p) => (doneStages[p.id] ?? []).length > 0 && (doneStages[p.id] ?? []).length < 5).length,    icon: BarChart3     },
                    { label: "Não iniciados",    value: myProcs.filter((p) => (doneStages[p.id] ?? []).length === 0).length,                                         icon: AlertTriangle },
                  ].map((s, i) => (
                    <div key={i} className="rounded-2xl bg-background ring-1 ring-border p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-ink-soft">{s.label}</span>
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface"><s.icon className="h-4 w-4 text-ink-soft" /></div>
                      </div>
                      <div className="font-serif text-3xl font-bold">{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-2xl bg-background ring-1 ring-border p-6">
                  <div className="text-sm font-medium mb-4">Progresso por caso</div>
                  <div className="space-y-3">
                    {myProcs.map((p) => (
                      <div key={p.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-ink-soft">{p.name}</span>
                          <span className="text-xs font-medium">{progress(p.id)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress(p.id)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── NOTIFICAÇÕES ── */}
            {mainSection === "notificacoes" && (
              <motion.div key="notifs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
                <div className="mb-8">
                  <div className="text-[10px] uppercase tracking-widest text-ink-soft">Comunicação</div>
                  <h2 className="font-serif text-2xl tracking-tight">Notificações</h2>
                </div>
                {totalUnread === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background p-12 text-center">
                    <Bell className="mx-auto h-10 w-10 text-ink-soft/30 mb-3" />
                    <div className="text-sm text-ink-soft">Nenhuma notificação por enquanto.</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {acceptedIds.map((pid) => {
                      const count = unreadCount(pid);
                      const proc  = MOCK_PROCESSES.find((p) => p.id === pid);
                      if (!proc || count === 0) return null;
                      return (
                        <div key={pid} onClick={() => { openProcess(pid); setRightTab("chat"); markChatRead(pid); }}
                          className="flex items-center justify-between rounded-2xl bg-background ring-1 ring-border p-4 cursor-pointer hover:ring-foreground/30 transition-colors">
                          <div>
                            <div className="text-sm font-medium">{proc.client} — {proc.name}</div>
                            <div className="text-xs text-ink-soft mt-1">{count} mensagem{count !== 1 ? "s" : ""} não lida{count !== 1 ? "s" : ""}</div>
                          </div>
                          <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{count > 9 ? "9+" : count}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── CONFIGURAÇÕES ── */}
            {mainSection === "configuracoes" && (
              <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
                <div className="mb-8">
                  <div className="text-[10px] uppercase tracking-widest text-ink-soft">Preferências</div>
                  <h2 className="font-serif text-2xl tracking-tight">Configurações</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Notificações por email", desc: "Alertas quando houver mensagens novas" },
                    { label: "Avisos de atraso",       desc: "Alertas para etapas próximas do prazo" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl bg-background ring-1 ring-border p-5">
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-ink-soft mt-0.5">{item.desc}</div>
                      </div>
                      <div className="h-6 w-11 rounded-full bg-foreground/20 ring-1 ring-border" />
                    </div>
                  ))}
                  <Link to="/perfil-profissional" className="block w-full rounded-xl bg-foreground py-3 text-center text-sm text-background hover:bg-foreground/90 transition-colors">
                    Ver perfil completo
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── PROCESSOS: trabalho ── */}
            {mainSection === "processos" && selectedProc && (
          <motion.div
            key={`work-${selectedId}`}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="grid h-screen grid-cols-[210px_1fr_272px] overflow-hidden"
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
                      {hasOpenPendencies(selectedId!, activeStage) ? (
                        <div className="flex flex-1 items-center gap-2 text-xs text-red-500">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Resolva as pendências antes de concluir
                        </div>
                      ) : (
                        <p className="flex-1 text-xs text-ink-soft">
                          {hasAnyField(selectedId!, activeStage) ? "Pronto para concluir." : "Preencha ao menos um campo."}
                        </p>
                      )}
                      <button
                        onClick={() => setShowPendencyForm(true)}
                        className="rounded-full border border-border px-3 py-2 text-xs text-ink-soft hover:bg-surface transition-colors"
                      >
                        + Pendência
                      </button>
                      <button
                        onClick={() => completeStage(selectedId!, activeStage)}
                        disabled={!hasAnyField(selectedId!, activeStage) || hasOpenPendencies(selectedId!, activeStage)}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Concluir etapa {activeStage}
                      </button>
                    </>
                  )}
                  {/* Pendências abertas desta etapa */}
                  {selectedId && openPendencies(selectedId, activeStage).length > 0 && (
                    <div className="mt-2 w-full space-y-1.5">
                      {openPendencies(selectedId, activeStage).map((p) => (
                        <div key={p.id} className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="flex-1">{p.description}</span>
                          <button onClick={() => resolvePendency(selectedId, p.id)} className="font-medium underline hover:no-underline">Resolver</button>
                        </div>
                      ))}
                    </div>
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
                    {selectedProc.type}
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
                    <button
                      onClick={() => {
                        if (selectedId && window.confirm("Recusar este caso? Ele volta para a equipe redistribuir.")) {
                          declineProcess(selectedId);
                        }
                      }}
                      className="mt-2 w-full rounded-lg border border-border py-1.5 text-[11px] text-ink-soft hover:border-red-300 hover:text-red-500 transition-colors"
                    >
                      Recusar caso
                    </button>
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
                  {/* Barra inferior do chat */}
                  <div className="shrink-0 border-t border-border">
                    <form onSubmit={sendMsg} className="flex items-center gap-2 px-3 py-3">
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
                  </div>
                </>
              )}
            </aside>
          </motion.div>
            )}
          </AnimatePresence>
        </main>

      {/* ── MODAL PENDÊNCIA ── */}
      {showPendencyForm && selectedId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center" onClick={() => setShowPendencyForm(false)}>
          <div className="w-full rounded-t-3xl bg-background p-6 sm:mx-auto sm:w-[440px] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-serif text-xl">Solicitar Pendência</h3>
              <button onClick={() => setShowPendencyForm(false)} className="rounded-full p-1 hover:bg-surface"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-4 text-sm text-ink-soft">Etapa {activeStage} — descreva o que está bloqueado</p>
            <textarea
              value={pendencyInput}
              onChange={(e) => setPendencyInput(e.target.value)}
              placeholder="Ex: Aguardando documento do cliente, falta assinatura, aguardando prefeitura..."
              rows={4}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none resize-none focus:border-foreground/30 placeholder:text-ink-soft/50"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setShowPendencyForm(false); setPendencyInput(""); }} className="flex-1 rounded-xl border border-border py-2 text-sm text-ink-soft hover:bg-surface transition-colors">Cancelar</button>
              <button
                onClick={() => createPendency(selectedId, activeStage, pendencyInput)}
                disabled={!pendencyInput.trim()}
                className="flex-1 rounded-xl bg-foreground py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-40 transition-colors"
              >Criar Pendência</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
