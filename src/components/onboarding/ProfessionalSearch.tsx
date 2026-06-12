import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Check, Clock } from "lucide-react";

/** Curiosidades exibidas enquanto o cliente aguarda um profissional. */
const CURIOSIDADES = [
  "O Parthenon, em Atenas, foi erguido sem argamassa — só encaixes precisos de mármore.",
  "A planta de uma casa é chamada de “planta baixa” porque mostra um corte horizontal visto de cima.",
  "Brasília foi projetada por Lúcio Costa e Oscar Niemeyer e é Patrimônio da Humanidade pela UNESCO.",
  "Regularizar um imóvel pode valorizá-lo em até 30% no mercado.",
  "O “habite-se” atesta que uma construção está pronta e segura para ser ocupada.",
  "A usucapião permite adquirir um imóvel após anos de posse mansa e pacífica.",
  "A matrícula é a “certidão de nascimento” do imóvel — única e individual no cartório.",
  "O termo “pé-direito” se refere à altura entre o piso e o teto de um ambiente.",
];

function useRotatingCuriosidade() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * CURIOSIDADES.length));
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CURIOSIDADES.length), 5000);
    return () => clearInterval(t);
  }, []);
  return CURIOSIDADES[idx];
}

/** Animação de radar — pulsos concêntricos com um ícone de busca ao centro. */
function RadarPulse() {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-accent/40"
          initial={{ width: 32, height: 32, opacity: 0.6 }}
          animate={{ width: 96, height: 96, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
        />
      ))}
      <div className="relative grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Search className="h-5 w-5" />
      </div>
    </div>
  );
}

/** Card grande — usado na aba "Profissional" do dashboard quando ainda não há especialista. */
export function SearchingProfessionalCard() {
  const curiosidade = useRotatingCuriosidade();

  return (
    <div className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
      <div className="text-xs text-ink-soft mb-1">Responsável pelo processo</div>
      <h2 className="font-serif text-2xl tracking-tight mb-8">Buscando seu especialista</h2>

      <div className="flex flex-col items-center text-center py-6">
        <RadarPulse />
        <h3 className="mt-6 font-serif text-xl">Procurando o profissional ideal para o seu caso</h3>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">
          Nossa equipe está analisando seu cadastro para designar o especialista mais adequado
          ao tipo e à situação do seu imóvel. Você será avisado assim que ele assumir o processo.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-ink-soft">
          <Clock className="h-3.5 w-3.5" /> Normalmente leva até 24h úteis
        </div>
      </div>

      {/* Curiosidade rotativa */}
      <div className="mt-4 rounded-2xl bg-surface-elevated p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent mb-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Você sabia?
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={curiosidade}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-ink-soft leading-relaxed"
          >
            {curiosidade}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Versão compacta — usada no card de preview da visão geral. */
export function SearchingProfessionalMini() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-9 w-9 place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full border border-accent/40"
          animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent">
          <Search className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className="text-sm font-medium">Buscando especialista</div>
        <div className="text-xs text-ink-soft">Designaremos em breve</div>
      </div>
    </div>
  );
}

/** Popup exibido após o tutorial — confirma que a busca pelo profissional começou. */
export function SearchingProfessionalsModal({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md rounded-3xl bg-background p-8 text-center shadow-2xl ring-1 ring-border"
      >
        <div className="flex justify-center">
          <RadarPulse />
        </div>
        <h2 className="mt-6 font-serif text-2xl tracking-tight">
          Vamos buscar os melhores profissionais para o seu caso
        </h2>
        <p className="mt-3 text-sm text-ink-soft leading-relaxed">
          Recebemos seu cadastro! A partir de agora, nossa equipe analisa as informações do
          seu imóvel e designa o especialista mais adequado. Assim que ele assumir, você verá
          tudo se atualizar aqui no painel.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={onDone}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm text-background hover:opacity-80 transition-opacity"
          >
            <Check className="h-4 w-4" /> Tudo bem
          </button>
          <button
            onClick={onDone}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm text-ink-soft hover:border-foreground/30 transition-colors"
          >
            <Clock className="h-4 w-4" /> Vou aguardar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
