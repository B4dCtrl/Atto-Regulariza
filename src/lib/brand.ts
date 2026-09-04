/**
 * Atendimento da Ato: (41) 98447-1404.
 *
 * Número único. Antes havia um segundo, de DDD 67, atendendo os botões
 * institucionais — imobiliária e construtora caíam num telefone de outro
 * estado, sem que ninguém percebesse porque o link parecia igual.
 */
export const ATENDIMENTO_PHONE = "5541984471404";

const wa = (text: string, phone: string = ATENDIMENTO_PHONE) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

export const WHATSAPP = {
  avaliacaoGratuita: wa(
    "Olá! Quero uma avaliação gratuita do meu caso de regularização imobiliária.",
  ),
  parceriaInstitucional: wa("Olá! Sou de uma imobiliária/construtora e quero avaliar parceria."),
  consultor: wa("Olá! Gostaria de falar com um consultor sobre planos institucionais."),
  /** Profissional aguardando liberação do cadastro. */
  cadastroEmAnalise: wa(
    "Olá! Sou profissional e me cadastrei na Ato Regulariza. Meu cadastro está em análise e gostaria de saber o andamento.",
  ),
} as const;

export const HERO_VIDEO_LOCAL = "/flutuando-reg.mp4";
export const HERO_VIDEO_FALLBACK =
  "https://videos.pexels.com/video-files/34030196/34030196-uhd_2560_1440_25fps.mp4";
