import { useState, type DragEvent } from "react";

import { GripVertical, Building2, Clock, User } from "lucide-react";

type Status = "entrada" | "analise" | "prefeitura" | "entregue";

type Card = {
  id: string;
  imovel: string;
  cliente: string;
  bairro: string;
  prazo: string;
  status: Status;
};

const initial: Card[] = [
  { id: "1", imovel: "Apto 142", cliente: "Marina Silveira", bairro: "Vila Madalena · SP", prazo: "hoje", status: "entrada" },
  { id: "2", imovel: "Casa Térrea", cliente: "João Pacheco", bairro: "Moema · SP", prazo: "2d", status: "entrada" },
  { id: "3", imovel: "Cobertura 21", cliente: "Construtora Vértice", bairro: "Itaim · SP", prazo: "5d", status: "analise" },
  { id: "4", imovel: "Lote 88", cliente: "Imobiliária Norte", bairro: "Campo Grande · MS", prazo: "1d", status: "analise" },
  { id: "5", imovel: "Sala comercial 305", cliente: "Carla Rocha", bairro: "Pinheiros · SP", prazo: "agora", status: "prefeitura" },
  { id: "6", imovel: "Apto 808", cliente: "Renato Lima", bairro: "Botafogo · RJ", prazo: "12d", status: "prefeitura" },
  { id: "7", imovel: "Galpão B", cliente: "VG Logística", bairro: "Guarulhos · SP", prazo: "concluído", status: "entregue" },
];

const columns: { id: Status; label: string; tone: string }[] = [
  { id: "entrada", label: "Entrada", tone: "bg-surface" },
  { id: "analise", label: "Em análise", tone: "bg-surface" },
  { id: "prefeitura", label: "Em prefeitura", tone: "bg-foreground text-background" },
  { id: "entregue", label: "Entregue", tone: "bg-accent/10" },
];

export function Kanban() {
  const [cards, setCards] = useState<Card[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const onDragStart = (id: string) => (e: DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (col: Status) => (e: DragEvent) => {
    e.preventDefault();
    if (!dragId) return;
    setCards((cs) => cs.map((c) => (c.id === dragId ? { ...c, status: col } : c)));
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {columns.map((col) => {
        const list = cards.filter((c) => c.status === col.id);
        const isHead = col.id === "prefeitura";
        return (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={onDrop(col.id)}
            className={`rounded-2xl p-3 ring-1 ring-border transition-colors ${
              overCol === col.id ? "bg-accent/5 ring-accent/40" : "bg-background"
            }`}
          >
            <div className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs ${col.tone}`}>
              <span className="flex items-center gap-2">
                {isHead && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                {col.label}
              </span>
              <span className={isHead ? "text-background/70" : "text-ink-soft"}>{list.length}</span>
            </div>

            <div className="space-y-2 min-h-[120px]">
              {list.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={onDragStart(c.id)}
                  className="group cursor-grab active:cursor-grabbing rounded-xl bg-background ring-1 ring-border p-3 hover:ring-foreground/30 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface">
                      <Building2 className="h-4 w-4 text-ink-soft" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.imovel}</div>
                      <div className="text-[11px] text-ink-soft truncate">{c.bairro}</div>
                    </div>
                    <GripVertical className="h-3.5 w-3.5 text-ink-soft/50 opacity-0 group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
                    <span className="flex items-center gap-1 truncate"><User className="h-3 w-3" /> {c.cliente}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {c.prazo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
