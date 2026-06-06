import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <div className="p-8">
      <div className="text-[10px] uppercase tracking-widest text-ink-soft">Clientes</div>
      <h1 className="font-serif text-3xl tracking-tight">Sua base de clientes</h1>
      <p className="mt-4 text-sm text-ink-soft">
        Em breve: cadastro PF, imobiliárias e construtoras com histórico unificado.
      </p>
    </div>
  );
}
