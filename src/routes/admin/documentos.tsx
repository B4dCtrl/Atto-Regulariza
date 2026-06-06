import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/documentos")({
  component: DocumentosPage,
});

function DocumentosPage() {
  return (
    <div className="p-8">
      <div className="text-[10px] uppercase tracking-widest text-ink-soft">Documentos</div>
      <h1 className="font-serif text-3xl tracking-tight">Central de documentos</h1>
      <p className="mt-4 text-sm text-ink-soft">
        Em breve: recebimento, análise e organização dos documentos de cada processo.
      </p>
    </div>
  );
}
