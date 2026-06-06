import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, FileText, X } from "lucide-react";

type Item = { name: string; size: string };

export function UploadZone() {
  const [items, setItems] = useState<Item[]>([
    { name: "Matrícula 14.882.pdf", size: "1.2 MB" },
    { name: "Habite-se rascunho.pdf", size: "820 KB" },
  ]);
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const add = (files: FileList | null) => {
    if (!files) return;
    setItems((d) => [
      ...Array.from(files).map((f) => ({
        name: f.name,
        size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      })),
      ...d,
    ]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };

  return (
    <div className="rounded-2xl bg-background ring-1 ring-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Documentos</div>
          <div className="font-serif text-xl tracking-tight">Upload rápido</div>
        </div>
        <button
          onClick={() => ref.current?.click()}
          className="rounded-full bg-foreground text-background px-3 py-1.5 text-xs"
        >
          Enviar
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => ref.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed py-6 px-4 text-center text-xs transition-colors ${
          over ? "border-accent bg-accent/5" : "border-border bg-surface/40"
        }`}
      >
        <Upload className="mx-auto h-4 w-4 text-accent" />
        <p className="mt-1.5">Arraste ou <span className="text-accent">clique para enviar</span></p>
        <p className="text-ink-soft mt-0.5">PDF, JPG, PNG · até 20 MB</p>
        <input
          ref={ref}
          type="file"
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => add(e.target.files)}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.slice(0, 4).map((it, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs">
            <FileText className="h-3.5 w-3.5 text-ink-soft" />
            <span className="flex-1 truncate">{it.name}</span>
            <span className="text-ink-soft">{it.size}</span>
            <button
              onClick={() => setItems((d) => d.filter((_, idx) => idx !== i))}
              className="text-ink-soft hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
