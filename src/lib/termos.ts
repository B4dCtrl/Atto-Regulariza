/**
 * Termos aceitos pelo usuário, e a versão deles.
 *
 * A versão é o que dá valor ao aceite: sem ela, você sabe que a pessoa
 * concordou, mas não com QUAL texto — e o texto muda. Ao alterar qualquer
 * cláusula abaixo, suba a versão: quem já aceitou será perguntado de novo.
 *
 * ATENÇÃO AO CONTEÚDO: estas cláusulas vieram das páginas públicas
 * `/termos-de-uso` e `/aviso-de-privacidade`, que tratam do USO DO SITE. Elas
 * não são contrato de prestação de serviço — não falam de prazo, preço nem
 * obrigação das partes, e o próprio texto diz que "a contratação dos serviços
 * de regularização ocorre por instrumento próprio". Servem para registrar
 * consentimento de dados (LGPD), não para sustentar discussão sobre o serviço.
 */

/** Formato: data da última alteração do texto. */
export const VERSAO_TERMOS = "2026-08-24";

export type Clausula = { titulo: string; texto: string };

export const CLAUSULAS: Clausula[] = [
  {
    titulo: "1. Objeto",
    texto:
      "A Ato Regulariza é uma plataforma de regularização imobiliária. O conteúdo institucional " +
      "tem caráter informativo; a contratação dos serviços de regularização ocorre por " +
      "instrumento próprio.",
  },
  {
    titulo: "2. O conteúdo não constitui aconselhamento jurídico ou técnico",
    texto:
      "As informações da plataforma têm caráter geral e não substituem a análise individualizada " +
      "de um caso concreto. O acesso não cria, por si só, vínculo contratual, que se estabelece " +
      "apenas mediante contratação específica e formal.",
  },
  {
    titulo: "3. Dados que tratamos",
    texto:
      "Para conduzir a regularização, tratamos nome, CPF, contato, endereço do imóvel e os " +
      "documentos que você enviar — incluindo matrícula, escritura, identidade e comprovantes. " +
      "Esses dados são usados para analisar seu caso, elaborar as peças técnicas e protocolar " +
      "junto aos órgãos competentes.",
  },
  {
    titulo: "4. Com quem esses dados são compartilhados",
    texto:
      "Com o profissional habilitado designado para o seu caso, e com os órgãos públicos e " +
      "cartórios necessários ao andamento do processo. Não vendemos nem cedemos seus dados para " +
      "finalidade publicitária.",
  },
  {
    titulo: "5. Onde ficam armazenados",
    texto:
      "Os dados são armazenados em servidores do nosso provedor de infraestrutura, que pode " +
      "operar fora do Brasil. A transferência internacional ocorre para viabilizar a prestação " +
      "do serviço que você contratou.",
  },
  {
    titulo: "6. Seus direitos",
    texto:
      "Você pode solicitar acesso, correção ou exclusão dos seus dados, bem como informação sobre " +
      "com quem foram compartilhados, escrevendo para contato@atoregulariza.com.br. Atendemos no " +
      "prazo da Lei Geral de Proteção de Dados.",
  },
  {
    titulo: "7. Uso adequado",
    texto:
      "Você se compromete a usar a plataforma de forma lícita, a enviar documentos verdadeiros e " +
      "a não praticar atos que violem direitos de terceiros ou a legislação aplicável.",
  },
];
