import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/processos")({
  component: ProcessosPage,
});

function ProcessosPage() {
  return (
    <div className="p-8">
      <div className="text-[10px] uppercase tracking-widest text-ink-soft">Processos</div>
      <h1 className="font-serif text-3xl tracking-tight">Todos os processos</h1>
      <p className="mt-4 text-sm text-ink-soft">
        Em breve: listagem completa, filtros por etapa, cidade e responsável.
      </p>
    </div>
  );
}
