import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, X, FileText, Home, Clock, MessageSquare } from "lucide-react";

const STEPS = [
  {
    icon: Home,
    color: "bg-accent/10 text-accent",
    title: "Seu painel em tempo real",
    desc: "Aqui você acompanha cada etapa da regularização do seu imóvel. A barra de progresso e as etapas são atualizadas pelo profissional responsável.",
  },
  {
    icon: FileText,
    color: "bg-blue-50 text-blue-700",
    title: "Envie seus documentos",
    desc: "Na aba Documentos você verá a lista do que precisa enviar. Quando fizer o upload, nossa equipe analisa e confirma em até 24h úteis.",
  },
  {
    icon: MessageSquare,
    color: "bg-green-50 text-green-700",
    title: "Fale com seu especialista",
    desc: "Na aba Mensagens você tem contato direto com o profissional dedicado ao seu processo. Sem intermediários, sem espera.",
  },
  {
    icon: Clock,
    color: "bg-yellow-50 text-yellow-700",
    title: "Prazos e próximas ações",
    desc: "O painel sempre mostra o que acontece a seguir e quando. Você nunca fica sem saber em que pé está seu processo.",
  },
];

export function FirstTimeTutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md rounded-3xl bg-background shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-soft">Bem-vindo ao</div>
            <div className="font-arsenica text-xl text-accent">Ato Regulariza</div>
          </div>
          <button
            onClick={onDone}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface text-ink-soft transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-6" style={{ minHeight: 180 }}>
          <AnimatePresence mode="wait">
            {STEPS.map((s, i) =>
              step === i ? (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4 ${s.color}`}>
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h2 className="font-serif text-xl mb-2">{s.title}</h2>
                  <p className="text-sm text-ink-soft leading-relaxed">{s.desc}</p>
                </motion.div>
              ) : null
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-ink-soft">
            {step + 1} de {STEPS.length}
          </span>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm text-background hover:opacity-80 transition-opacity"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onDone}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm text-white hover:opacity-80 transition-opacity"
            >
              <Check className="h-4 w-4" /> Entendi, vamos lá!
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
