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
          Entenda <em className="text-ink-soft">cada etapa</em> da regularização do seu
          imóvel. Parece simples — porque é.
        </p>
      </motion.div>
    </section>
  );
}
