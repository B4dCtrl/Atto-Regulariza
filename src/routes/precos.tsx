import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, ArrowUpRight, MessageCircle, Sparkles, Building2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BlurReveal } from "@/components/landing/BlurReveal";
import { WHATSAPP } from "@/lib/brand";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Regulariza" },
      {
        name: "description",
        content: "Preços por produto para regularizar seu imóvel. Sem mensalidade, sem letras miúdas.",
      },
    ],
  }),
  component: PrecosPage,
});

const products = [
  {
    name: "Regularização de matrícula",
    price: "a partir de R$ 3.999,99",
    period: "por imóvel",
    desc: "Atualização de registro, pendências cartoriais e documentação básica.",
    features: [
      "Análise documental completa",
      "Especialista designado",
      "Acompanhamento no painel",
      "Tramitação cartorial",
    ],
  },
  {
    name: "Habite-se / Averbação",
    price: "a partir de R$ 3.999,99",
    period: "por imóvel",
    tag: "Mais pedido",
    popular: true,
    desc: "Legalização junto à prefeitura e registro da construção ou alteração.",
    features: [
      "Prefeitura + cartório",
      "Resolução de exigências",
      "Timeline visual",
      "Suporte prioritário",
    ],
  },
  {
    name: "Casos complexos",
    price: "Sob consulta",
    period: "usucapião, inventário, multipropriedade",
    desc: "Situações que exigem estratégia jurídica e operação dedicada.",
    features: [
      "Equipe especializada",
      "Advogado no caso",
      "Prazo personalizado",
      "Mediação cartorial",
    ],
  },
  {
    name: "Unificação / Desmembramento",
    price: "a partir de R$ 3.999,00",
    period: "por imóvel",
    note: "valor base para 2 terrenos",
    desc: "União ou divisão de terrenos com nova matrícula registrada.",
    features: [
      "Planta e memorial descritivo",
      "Aprovação na prefeitura",
      "Abertura de novas matrículas",
      "Registro em cartório",
    ],
  },
  {
    name: "Retificação",
    price: "a partir de R$ 2.899,00",
    period: "por imóvel",
    desc: "Correção de área, medidas ou dados divergentes na matrícula.",
    features: [
      "Levantamento e georreferenciamento",
      "Anuência de confrontantes",
      "Planta técnica assinada",
      "Averbação na matrícula",
    ],
  },
  {
    name: "Usucapião extrajudicial",
    price: "Sob consulta",
    period: "por imóvel",
    desc: "Reconhecimento de propriedade sem processo judicial, em cartório.",
    features: [
      "Ata notarial",
      "Planta e memorial assinados",
      "Advogado dedicado",
      "Sem ação na justiça",
    ],
  },
];

const compareRows = [
  { label: "Painel acompanhável em tempo real", v: [true, true, true] },
  { label: "Tramitação em cartório", v: [true, true, true] },
  { label: "Tramitação em prefeitura", v: [false, true, true] },
  { label: "Casos complexos (usucapião, inventário)", v: [false, false, true] },
  { label: "Equipe jurídica dedicada", v: [false, false, true] },
];

const faqs = [
  {
    q: "Em quanto tempo um especialista assume meu caso?",
    a: "Em até 24 horas úteis após a contratação ou avaliação aprovada.",
  },
  {
    q: "Posso parcelar?",
    a: "Sim. Muitos casos podem ser parcelados — confirmamos na avaliação gratuita.",
  },
  {
    q: "E se eu já comecei a regularização em outro lugar?",
    a: "Sem problema. Nossa equipe assume de onde está, sem refazer trabalho.",
  },
  {
    q: "Sou imobiliária ou construtora?",
    a: "Veja planos institucionais com volume, SLA e multi-usuário.",
  },
  {
    q: "Como funciona a avaliação gratuita?",
    a: "Você conta o caso pelo WhatsApp. Analisamos documentos e devolvemos prazo e investimento estimados.",
  },
];

function PrecosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="pt-32">
        <section className="px-6 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
              <Sparkles className="h-3 w-3 text-accent" /> Pessoa física
            </div>
            <h1 className="font-serif text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[1] tracking-tight text-balance">
              Preços por produto,
              <br />
              <em className="italic text-ink-soft">sem mensalidade.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft">
              Cada imóvel é diferente. A avaliação gratuita define o escopo exato — sem surpresa no
              meio do processo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={WHATSAPP.avaliacaoGratuita}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background transition-all hover:scale-[1.02]"
              >
                <MessageCircle className="h-4 w-4" />
                Avaliação gratuita
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </a>
              <Link
                to="/precos/institucional"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3 text-base transition-all hover:border-foreground/30"
              >
                <Building2 className="h-4 w-4" />
                Sou empresa · Preços B2B
              </Link>
            </div>
          </motion.div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {products.map((p, i) => (
              <BlurReveal key={p.name}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl p-7 ring-1 transition-all hover:-translate-y-1 ${
                    p.popular
                      ? "bg-foreground text-background ring-foreground shadow-[0_30px_80px_-40px_oklch(0.66_0.18_38_/_0.6)]"
                      : "bg-surface-elevated ring-border"
                  }`}
                >
                  {p.tag && (
                    <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[11px] text-accent-foreground">
                      {p.tag}
                    </span>
                  )}
                  <div className={`text-center font-serif text-2xl italic leading-snug sm:text-[1.7rem] ${p.popular ? "text-background" : "text-foreground"}`}>
                    {p.name}
                  </div>
                  <div className="mt-3 text-center font-serif text-3xl leading-tight sm:text-4xl">{p.price}</div>
                  {p.note && (
                    <div className={`mt-1 text-center text-[11px] italic ${p.popular ? "text-background/50" : "text-ink-soft/70"}`}>
                      {p.note}
                    </div>
                  )}
                  <div className={`mt-1 text-center text-xs ${p.popular ? "text-background/60" : "text-ink-soft"}`}>
                    {p.period}
                  </div>
                  <p
                    className={`mt-4 text-sm leading-relaxed ${p.popular ? "text-background/80" : "text-ink-soft"}`}
                  >
                    {p.desc}
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 grid h-4 w-4 place-items-center rounded-[5px] ${
                            p.popular ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={WHATSAPP.avaliacaoGratuita}
                    target="_blank"
                    rel="noreferrer"
                    className={`group mt-8 inline-flex items-center justify-center gap-2 rounded-full py-3 pl-5 pr-3 text-sm transition-all ${
                      p.popular
                        ? "bg-background text-foreground hover:scale-[1.02]"
                        : "bg-foreground text-background hover:scale-[1.02]"
                    }`}
                  >
                    {i === 2 ? "Consultar caso" : "Avaliação gratuita"}
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </a>
                </div>
              </BlurReveal>
            ))}
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-surface-elevated ring-1 ring-border">
            <div className="grid grid-cols-4 border-b border-border bg-surface px-4 py-4 text-xs uppercase tracking-wider text-ink-soft sm:px-6">
              <div>Comparativo</div>
              {products.slice(0, 3).map((p) => (
                <div
                  key={p.name}
                  className="hidden text-center font-medium normal-case tracking-normal text-foreground sm:block"
                >
                  {p.name.split(" ")[0]}
                </div>
              ))}
            </div>
            {compareRows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-4 items-center border-b border-border px-4 py-3.5 text-sm last:border-0 sm:px-6"
              >
                <div className="col-span-1 text-ink-soft sm:col-span-1">{row.label}</div>
                {row.v.map((ok, j) => (
                  <div key={j} className="hidden justify-center sm:flex">
                    {ok ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-ink-soft/40">—</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h2 className="font-serif text-4xl tracking-tight">Dúvidas frequentes</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border">
                  <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-ink-soft">
                    {f.q.includes("imobiliária") ? (
                      <>
                        {f.a}{" "}
                        <Link to="/precos/institucional" className="text-foreground underline">
                          Ver preços B2B
                        </Link>
                        .
                      </>
                    ) : (
                      f.a
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-6 pb-28">
          <div className="mx-auto max-w-4xl rounded-[36px] bg-foreground p-12 text-center text-background">
            <h2 className="font-serif text-4xl tracking-tight">Ainda em dúvida?</h2>
            <p className="mt-3 text-background/70">Fale com a gente. Respondemos rápido, sem juridiquês.</p>
            <a
              href={WHATSAPP.avaliacaoGratuita}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-background py-3 pl-6 pr-3 text-base text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              Avaliação gratuita no WhatsApp
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
