import { motion } from "framer-motion";

const partners = [
  "Prefeitura SP",
  "Cartório 5º Ofício",
  "CRECI",
  "CAU/BR",
  "Receita Federal",
  "ITBI",
];

export function LogoBar() {
  return (
    <section className="border-y border-border/60 bg-surface/40 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-ink-soft">
          Integrado com órgãos e profissionais em todo o Brasil
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14"
        >
          {partners.map((p) => (
            <span
              key={p}
              className="font-serif text-xl tracking-tight text-ink-soft/70 transition-colors hover:text-foreground"
            >
              {p}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
