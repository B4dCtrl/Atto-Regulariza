export const BRAND_NAME = "Regulariza";
export const BRAND_PHONE = "5567998513179";

/** Atendimento do site: (41) 98447-1404. Separado do BRAND_PHONE de propósito —
 *  quem entra pela landing cai neste número, não no institucional. */
export const ATENDIMENTO_PHONE = "5541984471404";

const wa = (text: string, phone: string = BRAND_PHONE) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

export const WHATSAPP = {
  avaliacaoGratuita: wa(
    "Olá! Quero uma avaliação gratuita do meu caso de regularização imobiliária.",
    ATENDIMENTO_PHONE,
  ),
  parceriaInstitucional: wa("Olá! Sou de uma imobiliária/construtora e quero avaliar parceria."),
  consultor: wa("Olá! Gostaria de falar com um consultor sobre planos institucionais."),
} as const;

export const HERO_VIDEO_LOCAL = "/flutuando-reg.mp4";
export const HERO_VIDEO_FALLBACK =
  "https://videos.pexels.com/video-files/34030196/34030196-uhd_2560_1440_25fps.mp4";
