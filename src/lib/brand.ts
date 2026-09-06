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

/**
 * Mensagens que o cliente envia ao abrir o WhatsApp pelo site.
 *
 * Cada uma diz **de onde a pessoa veio e quem ela é** — dono de imóvel,
 * imobiliária, profissional já cadastrado. Antes todas diziam só o que a
 * pessoa queria, e quatro botões diferentes chegavam como a mesma conversa.
 *
 * As duas linhas em branco no fim são de propósito: quem completa poupa uma
 * ida e volta, e quem não completa mandou uma mensagem normal — não custa
 * nada. Nunca mais que dois campos; formulário disfarçado de mensagem afasta.
 */
export const WHATSAPP = {
  /** Dono de imóvel, vindo dos CTAs da landing. */
  avaliacaoGratuita: wa(
    "Olá! Vim pelo site da Ato Regulariza e quero regularizar meu imóvel.\n\nCidade do imóvel: \nO que preciso resolver: ",
  ),

  /** Mesma intenção, mas vindo da página de obras — vale saber a diferença. */
  adiantarCaso: wa(
    "Olá! Vim pela página inicial da Ato Regulariza e quero adiantar meu caso de regularização.\n\nCidade do imóvel: \nO que preciso resolver: ",
  ),

  /** Imobiliária ou construtora avaliando parceria. */
  parceriaInstitucional: wa(
    "Olá! Vim pela página institucional da Ato Regulariza. Represento uma imobiliária/construtora e quero avaliar uma parceria.\n\nEmpresa: \nCidade de atuação: ",
  ),

  /** Interesse nos planos institucionais. */
  consultor: wa(
    "Olá! Vim pela página institucional da Ato Regulariza e gostaria de falar com um consultor sobre os planos.\n\nEmpresa: \nQuantos imóveis por mês: ",
  ),

  /** Profissional aguardando liberação do cadastro. */
  cadastroEmAnalise: wa(
    "Olá! Sou profissional e me cadastrei na Ato Regulariza. Meu cadastro está em análise e gostaria de saber o andamento.\n\nNome completo: \nProfissão: ",
  ),
} as const;

export const HERO_VIDEO_LOCAL = "/flutuando-reg.mp4";
export const HERO_VIDEO_FALLBACK =
  "https://videos.pexels.com/video-files/34030196/34030196-uhd_2560_1440_25fps.mp4";
