/**
 * Triagem inicial do caso, antes de qualquer atendimento humano.
 *
 * Oito perguntas que separam o que dá para orçar na hora do que precisa de
 * análise. A classificação é função pura — não conhece WhatsApp, site nem
 * banco de dados — para valer igual em qualquer canal e ser testável sozinha.
 *
 * Sobre as cores:
 * - **verde**: dono, com matrícula no próprio nome, caso de tamanho conhecido.
 *   Cabe orçamento de tabela.
 * - **amarelo**: dá para resolver, mas o preço e o caminho dependem de olhar
 *   documento — prazo de prefeitura, inventário, área grande.
 * - **vermelho**: questão de titularidade. Não é serviço de tabela, é disputa
 *   sobre de quem é o imóvel, e prometer preço aqui seria enganar.
 *
 * O que a triagem **não** faz: prometer prazo. Prazo depende de cartório e
 * prefeitura, e nenhuma resposta de bot muda isso.
 */

export type Motivo = "vender" | "heranca" | "notificacao" | "regularizar";
export type Imovel = "casa" | "apartamento" | "comercial" | "terreno";
export type Matricula = "propria" | "outro_nome" | "gaveta" | "nao_sei";
export type Divergencia = "nunca_averbada" | "ampliacao" | "area_nao_bate" | "nao_sei";
export type Area = "ate_70" | "70_150" | "150_300" | "mais_300";

export type Respostas = {
  motivo: Motivo;
  imovel: Imovel;
  cidade: string;
  matricula: Matricula;
  divergencia: Divergencia;
  area: Area;
  /** Texto livre. É o campo que a IA lê — a rede de segurança dos botões. */
  relato: string;
  nome: string;
};

export type Cor = "verde" | "amarelo" | "vermelho";

/** Produto do catálogo, quando dá para identificar. */
export type Produto = "habitese" | "retificacao" | "matricula" | null;

export type Resultado = {
  cor: Cor;
  /** Por que caiu nessa cor. Vai para a equipe, não para o cliente. */
  motivo: string;
  produto: Produto;
  /** Preço de tabela, ou null quando não se deve citar valor. */
  faixa: string | null;
  /** Cidade limpa, para achar o profissional parceiro da região. */
  cidade: string;
  relato: string;
  /** Mensagem pronta para enviar ao cliente. */
  mensagem: string;
};

/**
 * Uma alternativa de resposta.
 *
 * `curto` existe para canal com pouco espaço — resposta rápida do Instagram
 * cabe em 20 caracteres e não tem descrição, então cortar no meio deixaria a
 * pessoa escolhendo às cegas. Só as opções que passam do limite precisam.
 */
type Opcao<T> = { valor: T; rotulo: string; curto?: string };

type Pergunta =
  | { id: "cidade" | "relato" | "nome"; tipo: "texto"; texto: string }
  | { id: "motivo"; tipo: "opcoes"; texto: string; opcoes: Opcao<Motivo>[] }
  | { id: "imovel"; tipo: "opcoes"; texto: string; opcoes: Opcao<Imovel>[] }
  | { id: "matricula"; tipo: "opcoes"; texto: string; opcoes: Opcao<Matricula>[] }
  | { id: "divergencia"; tipo: "opcoes"; texto: string; opcoes: Opcao<Divergencia>[] }
  | { id: "area"; tipo: "opcoes"; texto: string; opcoes: Opcao<Area>[] };

/** O roteiro. Qualquer canal renderiza a partir daqui, na ordem. */
export const PERGUNTAS: readonly Pergunta[] = [
  {
    id: "motivo",
    tipo: "opcoes",
    texto: "O que te trouxe aqui?",
    opcoes: [
      { valor: "vender", rotulo: "Vender ou financiar" },
      { valor: "heranca", rotulo: "Herança / inventário" },
      { valor: "notificacao", rotulo: "Recebi notificação" },
      { valor: "regularizar", rotulo: "Só quero regularizar" },
    ],
  },
  {
    id: "imovel",
    tipo: "opcoes",
    texto: "Que tipo de imóvel?",
    opcoes: [
      { valor: "casa", rotulo: "Casa ou sobrado" },
      { valor: "apartamento", rotulo: "Apartamento" },
      { valor: "comercial", rotulo: "Comercial" },
      { valor: "terreno", rotulo: "Terreno" },
    ],
  },
  { id: "cidade", tipo: "texto", texto: "Qual a cidade?" },
  {
    id: "matricula",
    tipo: "opcoes",
    texto: "Você tem a matrícula do imóvel no cartório?",
    opcoes: [
      { valor: "propria", rotulo: "Sim, no meu nome" },
      { valor: "outro_nome", rotulo: "Sim, em outro nome" },
      { valor: "gaveta", rotulo: "Contrato de gaveta" },
      { valor: "nao_sei", rotulo: "Não sei" },
    ],
  },
  {
    id: "divergencia",
    tipo: "opcoes",
    texto: "O que está diferente do que consta no papel?",
    opcoes: [
      { valor: "nunca_averbada", rotulo: "Construção nunca averbada", curto: "Nunca averbada" },
      { valor: "ampliacao", rotulo: "Ampliação ou reforma" },
      { valor: "area_nao_bate", rotulo: "Área não bate" },
      { valor: "nao_sei", rotulo: "Não sei dizer" },
    ],
  },
  {
    id: "area",
    tipo: "opcoes",
    texto: "Área construída, mais ou menos:",
    opcoes: [
      { valor: "ate_70", rotulo: "até 70m²" },
      { valor: "70_150", rotulo: "70 a 150" },
      { valor: "150_300", rotulo: "150 a 300" },
      { valor: "mais_300", rotulo: "mais de 300" },
    ],
  },
  { id: "relato", tipo: "texto", texto: "Me conta em uma frase o que está acontecendo:" },
  { id: "nome", tipo: "texto", texto: "Qual seu nome?" },
];

/**
 * Preço de tabela por produto.
 *
 * Espelha `/precos`. Se mudar lá, mudar aqui — dois preços diferentes para o
 * mesmo serviço é pior que não citar preço nenhum.
 */
const PRECO: Record<Exclude<Produto, null>, string> = {
  habitese: "a partir de R$ 3.999,99",
  retificacao: "a partir de R$ 2.899,00",
  matricula: "a partir de R$ 3.999,99",
};

function produtoDe(divergencia: Divergencia): Produto {
  switch (divergencia) {
    case "nunca_averbada":
    case "ampliacao":
      return "habitese";
    case "area_nao_bate":
      return "retificacao";
    // Sem saber o que diverge, chutar produto é chutar preço.
    case "nao_sei":
      return null;
  }
}

export function classificar(r: Respostas): Resultado {
  const cidade = r.cidade.trim();
  const nome = r.nome.trim();
  const primeiroNome = nome.split(/\s+/)[0] || "";
  const ola = primeiroNome ? `${primeiroNome}, ` : "";

  const comum = { cidade, relato: r.relato };

  // Titularidade decide antes de tudo. Quem não tem o imóvel no próprio nome
  // não tem um problema de averbação — tem um problema de propriedade, e
  // nenhuma resposta de tabela serve.
  if (r.matricula === "outro_nome" || r.matricula === "gaveta") {
    const detalhe =
      r.matricula === "gaveta"
        ? "compra por contrato de gaveta, sem registro"
        : "matrícula em nome de outra pessoa";
    return {
      ...comum,
      cor: "vermelho",
      motivo: `Questão dominial: ${detalhe}.`,
      produto: null,
      faixa: null,
      mensagem:
        `${ola}obrigado por contar. Pelo que você descreveu, antes de regularizar a construção ` +
        `é preciso resolver a titularidade — o imóvel ainda não está registrado no seu nome. ` +
        `Isso tem solução, mas o caminho depende dos documentos que você tem em mãos. ` +
        `Um especialista vai te chamar aqui para olhar seu caso.`,
    };
  }

  const produto = produtoDe(r.divergencia);
  const faixa = produto ? PRECO[produto] : null;

  if (r.matricula === "nao_sei") {
    return {
      ...comum,
      cor: "amarelo",
      motivo: "Não sabe em nome de quem está a matrícula — conferir antes de orçar.",
      produto,
      faixa: null,
      mensagem:
        `${ola}o primeiro passo é simples: precisamos ver a matrícula atualizada do imóvel ` +
        `para saber exatamente em que pé está o registro. Com ela em mãos conseguimos te dizer ` +
        `o que falta e quanto custa. Um especialista vai te orientar como pedir no cartório.`,
    };
  }

  if (r.motivo === "notificacao") {
    return {
      ...comum,
      cor: "amarelo",
      motivo: "Notificação recebida: há prazo correndo e prefeitura envolvida.",
      produto,
      faixa: null,
      mensagem:
        `${ola}notificação tem prazo, então vale tratar como prioridade. ` +
        `Guarde o documento que você recebeu — a data e o número dele mudam o caminho. ` +
        `Um especialista vai te chamar aqui para ver o que dá para fazer dentro do prazo.`,
    };
  }

  if (r.motivo === "heranca") {
    return {
      ...comum,
      cor: "amarelo",
      motivo: "Herança/inventário: caso sob consulta, pode exigir advogado.",
      produto,
      faixa: null,
      mensagem:
        `${ola}casos de herança têm um passo a mais: o imóvel precisa ser transferido ` +
        `aos herdeiros antes de qualquer regularização da construção. ` +
        `Depende de como está o inventário, então um especialista vai olhar seu caso.`,
    };
  }

  if (r.area === "mais_300") {
    return {
      ...comum,
      cor: "amarelo",
      motivo: "Área acima de 300 m² sai da faixa de tabela.",
      produto,
      faixa: null,
      mensagem:
        `${ola}acima de 300 m² o levantamento é mais extenso e o valor sai da nossa tabela padrão. ` +
        `Um especialista vai olhar seu caso e te passar o orçamento certo.`,
    };
  }

  const sobreProduto = faixa
    ? `No seu caso o serviço costuma ser ${rotuloProduto(produto)}, ${faixa}. `
    : `Com a matrícula em mãos conseguimos dizer exatamente qual serviço se aplica. `;

  return {
    ...comum,
    cor: "verde",
    motivo: "Titular com matrícula própria, caso dentro da faixa de tabela.",
    produto,
    faixa,
    mensagem:
      `${ola}pelo que você contou, seu caso é dos que a gente resolve com frequência. ` +
      sobreProduto +
      `O próximo passo é a matrícula atualizada do imóvel. ` +
      `Um especialista vai te chamar aqui para começar.`,
  };
}

function rotuloProduto(p: Produto): string {
  switch (p) {
    case "habitese":
      return "habite-se / averbação da construção";
    case "retificacao":
      return "retificação de área";
    case "matricula":
      return "regularização de matrícula";
    default:
      return "análise documental";
  }
}

/**
 * As respostas em português, para a equipe ler.
 *
 * O banco guarda o valor cru — `nunca_averbada` — porque é ele que a conversa
 * compara. Quem lê no painel precisa da frase inteira. Devolve na ordem em que
 * foram perguntadas, ignorando o que não foi respondido.
 */
export function descreverRespostas(
  respostas: Partial<Respostas>,
): { pergunta: string; resposta: string }[] {
  const saida: { pergunta: string; resposta: string }[] = [];

  for (const p of PERGUNTAS) {
    const valor = respostas[p.id];
    if (valor === undefined || valor === null || valor === "") continue;

    if (p.tipo === "texto") {
      saida.push({ pergunta: p.texto, resposta: String(valor) });
      continue;
    }

    const opcao = p.opcoes.find((o) => (o.valor as string) === valor);
    // Sem rótulo conhecido, mostra o valor cru: melhor um dado feio que um
    // dado ausente quando a equipe está decidindo o que fazer com o caso.
    saida.push({ pergunta: p.texto, resposta: opcao?.rotulo ?? String(valor) });
  }

  return saida;
}

/** Nome do produto para a equipe ler, ou null quando não foi identificado. */
export function nomeDoProduto(p: Produto): string | null {
  if (!p) return null;
  return rotuloProduto(p);
}
