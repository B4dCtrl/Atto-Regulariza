import { DocumentList } from "@/components/documentos/DocumentList";

/**
 * O que o profissional produziu no caso: projeto, ART/RRT, laudo, protocolo.
 *
 * Separado de "Seus documentos" porque são coisas de natureza oposta: lá o
 * cliente envia, aqui ele recebe. Misturados numa lista só, a RRT emitida se
 * perdia entre RG e comprovante de endereço.
 *
 * Só aparece o que o profissional liberou (ou tudo, depois da entrega) — a
 * regra mora no banco, em can_read_document. Esta tela não filtra nada além
 * da origem.
 */
export function DocumentosDoProfissional({
  propertyId,
  recarregarToken,
  comoCliente,
}: {
  propertyId: string;
  recarregarToken: number;
  comoCliente?: { processoEntregue: boolean };
}) {
  return (
    <section className="rounded-3xl bg-background p-6 ring-1 ring-border sm:p-8">
      <div className="mb-5">
        <div className="text-xs text-ink-soft">Do seu profissional</div>
        <h2 className="font-serif text-2xl tracking-tight">Documentos do seu caso</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Projetos, ART/RRT, laudos e protocolos que o profissional preparou para você. Toque para
          abrir ou baixar.
        </p>
      </div>

      <DocumentList
        propertyId={propertyId}
        origem="profissional"
        textoVazio="Assim que o profissional preparar um documento do seu caso, ele aparece aqui."
        comoCliente={comoCliente}
        recarregarToken={recarregarToken}
      />
    </section>
  );
}
