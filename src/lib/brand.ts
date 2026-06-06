export const BRAND_NAME = "Regulariza";
export const BRAND_PHONE = "5567998513179";

const wa = (text: string) =>
  `https://wa.me/${BRAND_PHONE}?text=${encodeURIComponent(text)}`;

export const WHATSAPP = {
  avaliacaoGratuita: wa(
    "Olá! Quero uma avaliação gratuita do meu caso de regularização imobiliária.",
  ),
  parceriaInstitucional: wa(
    "Olá! Sou de uma imobiliária/construtora e quero avaliar parceria.",
  ),
  consultor: wa("Olá! Gostaria de falar com um consultor sobre planos institucionais."),
} as const;

export const HERO_VIDEO_LOCAL = "/flutuando-reg.mp4";
export const HERO_VIDEO_FALLBACK =
  "https://videos.pexels.com/video-files/34030196/34030196-uhd_2560_1440_25fps.mp4";
