import { ReactNode } from "react"
import { TourStep } from "@/components/ui/tour"

export const TOUR_TOPICS = {
  WELCOME: "tour-welcome",
  PROPERTY_FORM: "tour-property-form",
  PROGRESS_BAR: "tour-progress-bar",
  TIMELINE: "tour-timeline",
  DOCUMENTS: "tour-documents",
  CHAT: "tour-chat",
} as const

export function getTourSteps(): TourStep[] {
  return [
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">Bem-vindo ao Ato Regulariza!</h3>
          <p className="text-sm text-muted-foreground">
            Você é cliente. Vamos regularizar seu imóvel de forma rápida e segura. Clique em "Próximo" para começar.
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.WELCOME,
      position: "bottom",
    },
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">1️⃣ Dados do Imóvel</h3>
          <p className="text-sm text-muted-foreground">
            Preencha aqui o endereço e informações básicas do seu imóvel. Usaremos isso para rastrear todo o processo.
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.PROPERTY_FORM,
      position: "top",
    },
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">📊 Progresso em Tempo Real</h3>
          <p className="text-sm text-muted-foreground">
            Você acompanha aqui cada etapa do processo. A barra sobe conforme as etapas são concluídas pelos profissionais.
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.PROGRESS_BAR,
      position: "bottom",
    },
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">⏱️ Timeline Visual</h3>
          <p className="text-sm text-muted-foreground">
            Aqui você vê as 5 etapas da regularização:
            <br />
            <span className="text-xs mt-1 block">Cadastro → Análise → Profissional → Tramitação → Entrega</span>
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.TIMELINE,
      position: "top",
    },
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">📄 Documentos</h3>
          <p className="text-sm text-muted-foreground">
            Envie aqui os documentos necessários. O profissional aprovará ou pedirá ajustes em tempo real.
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.DOCUMENTS,
      position: "top",
    },
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">💬 Chat com Profissional</h3>
          <p className="text-sm text-muted-foreground">
            Converse com seu especialista aqui. Dúvidas, pedidos e atualizações em tempo real. IA também ajuda!
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.CHAT,
      position: "left",
    },
    {
      content: (
        <div className="space-y-2">
          <h3 className="font-medium">✅ Pronto para começar!</h3>
          <p className="text-sm text-muted-foreground">
            Você pode revisar este tour a qualquer hora clicando no botão "Ajuda" no canto inferior direito.
          </p>
        </div>
      ),
      selectorId: TOUR_TOPICS.WELCOME,
      position: "bottom",
    },
  ]
}
