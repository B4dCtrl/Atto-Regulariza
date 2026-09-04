/**
 * Dados que buscadores e assistentes de IA leem sobre a Ato.
 *
 * Google entende a página pelo texto; assistente de IA prefere dado
 * estruturado, porque não precisa adivinhar. O JSON-LD abaixo diz de forma
 * explícita o que a empresa é, onde atende e o que oferece — é o que faz a
 * diferença entre ser citado como resposta e ser ignorado.
 *
 * Tudo aqui é constante do código. Nada vem de usuário, então serializar para
 * dentro de um <script> não abre injeção.
 */

export const SITE_URL = "https://www.atoregulariza.com.br";
export const OG_IMAGE = `${SITE_URL}/og-ato.png`;

/** Identidade da empresa. Alimenta o painel de conhecimento do Google. */
const ORGANIZACAO = {
  "@type": "ProfessionalService",
  "@id": `${SITE_URL}/#organizacao`,
  name: "Ato Regulariza",
  description:
    "Regularização de imóveis no Brasil: usucapião, retificação de área, averbação de construção e regularização fundiária, com acompanhamento online de cada etapa.",
  url: SITE_URL,
  logo: `${SITE_URL}/ato-lockup.png`,
  image: OG_IMAGE,
  telephone: "+5541984471404",
  email: "contato@atoregulariza.com.br",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Curitiba",
    addressRegion: "PR",
    addressCountry: "BR",
  },
  areaServed: { "@type": "Country", name: "Brasil" },
  knowsLanguage: "pt-BR",
  serviceType: [
    "Usucapião",
    "Retificação de área",
    "Averbação de construção",
    "Regularização fundiária",
    "Desmembramento de lote",
    "Inventário de imóvel",
  ],
};

/** O site em si, para o buscador ligar as páginas a uma mesma entidade. */
const SITE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#site`,
  url: SITE_URL,
  name: "Ato Regulariza",
  inLanguage: "pt-BR",
  publisher: { "@id": `${SITE_URL}/#organizacao` },
};

/**
 * Perguntas e respostas.
 *
 * É o formato que assistente de IA mais aproveita: pergunta em linguagem
 * natural com resposta curta ao lado. Responde sem prometer prazo — prazo em
 * regularização depende de cartório e prefeitura, e promessa que não se cumpre
 * custa mais caro que a visita ganha.
 */
const PERGUNTAS = {
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "O que é regularização de imóvel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "É fazer com que a realidade do imóvel — o que está construído, a área real do terreno, quem de fato é o dono — coincida com o que está escrito na matrícula do cartório de registro de imóveis. Sem essa correspondência o imóvel não pode ser vendido com segurança, financiado ou dado em garantia.",
      },
    },
    {
      "@type": "Question",
      name: "Quanto tempo demora para regularizar um imóvel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Depende do tipo de processo e, principalmente, do cartório e da prefeitura envolvidos — são prazos de terceiros, fora do controle de quem conduz o caso. A Ato mostra o andamento real de cada etapa no painel do cliente em vez de prometer uma data.",
      },
    },
    {
      "@type": "Question",
      name: "Quais documentos preciso para começar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No início, três: documento de identidade com foto, comprovante de endereço e a matrícula atualizada do imóvel. A partir da análise desses, a equipe indica o que mais o caso específico exige.",
      },
    },
    {
      "@type": "Question",
      name: "A Ato Regulariza atende em todo o Brasil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. O acompanhamento é online, e a rede de profissionais — arquitetos, engenheiros, advogados e despachantes — cobre as exigências locais de cada cidade.",
      },
    },
    {
      "@type": "Question",
      name: "O que é usucapião?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "É o reconhecimento da propriedade de quem ocupou o imóvel por tempo prolongado, de forma mansa e pacífica, sem contestação. Pode ser feito na via extrajudicial, direto no cartório, quando não há conflito entre as partes.",
      },
    },
  ],
};

/** Bloco único que vai no <head> de toda página. */
export const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [ORGANIZACAO, SITE, PERGUNTAS],
});
