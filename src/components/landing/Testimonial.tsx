import { motion } from "framer-motion";

export function Testimonial() {
  return (
    <section className="px-6 py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-4xl text-center"
      >
        <p className="font-serif text-[clamp(1.75rem,3.5vw,3rem)] leading-[1.15] tracking-tight text-balance">
          “Pela primeira vez eu entendi <em className="text-ink-soft">cada etapa</em> da
          regularização do meu imóvel. Parece simples — mas nunca tinha sido.”
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background text-sm">
            MS
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">Marina Silveira</div>
            <div className="text-xs text-ink-soft">Proprietária · São Paulo</div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
