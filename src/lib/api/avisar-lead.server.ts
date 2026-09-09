/**
 * Avisa a equipe no WhatsApp quando um caso chega.
 *
 * O painel do site já registra tudo, mas ninguém fica com o painel aberto: o
 * lead esfriava até alguém lembrar de olhar. Aqui o aviso vai para o telefone
 * de quem atende, na hora.
 *
 * Por que template e não texto: a API só deixa escrever livremente para quem
 * mandou mensagem nas últimas 24 horas. O aviso chega quando o *cliente* fala,
 * e nessa hora a janela com a equipe quase sempre está fechada — então a Meta
 * exige um modelo aprovado por ela. Mudar o texto exige nova aprovação; mudar
 * o que vai nas variáveis, não.
 *
 * NUNCA lança e nunca atrasa quem chamou: é aviso. Uma falha ao avisar não
 * pode derrubar a resposta ao cliente, que é o que importa.
 */

import process from "node:process";
import { ATENDIMENTO_PHONE } from "@/lib/brand";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import type { Cor } from "@/lib/triagem";

const HOST = "https://graph.facebook.com/v21.0";

/**
 * O modelo aprovado na Meta. Os nomes têm que bater com os de lá.
 *
 * `lead_triagem` substituiu um `novo_lead` que a Meta reclassificou como
 * marketing: "Novo lead" com link do site parecia divulgação. O texto atual
 * é registro de atendimento, que é o que ele de fato é — e o que a categoria
 * de utilidade cobre.
 */
type Modelo = "lead_triagem" | "pedido_atendente";

/** Cor da triagem como a equipe vê no celular: sem ler, só de bater o olho. */
const EMOJI: Record<Cor, string> = {
  verde: "🟢",
  amarelo: "🟡",
  vermelho: "🔴",
};

/**
 * Manda um template para o telefone da equipe.
 *
 * Os valores entram na ordem — {{1}}, {{2}}, … — e é isso que amarra este
 * código ao modelo aprovado: trocar a ordem lá exige trocar aqui.
 */
async function enviarModelo(modelo: Modelo, valores: string[]): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const origemId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !origemId) {
    console.error("[aviso] token ou id do WhatsApp ausente; lead não avisado");
    return;
  }

  const corpo = {
    messaging_product: "whatsapp",
    to: ATENDIMENTO_PHONE,
    type: "template",
    template: {
      name: modelo,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          // Campo vazio faz a Meta recusar a mensagem inteira; um travessão
          // diz "não temos esse dado" sem derrubar o aviso.
          parameters: valores.map((v) => ({ type: "text", text: v.trim() || "—" })),
        },
      ],
    },
  };

  const res = await fetch(`${HOST}/${origemId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    console.error(`[aviso] ${modelo} recusado`, res.status, detalhe.slice(0, 300));
    avisarErro(`aviso de ${modelo}`, `${res.status}: ${detalhe.slice(0, 200)}`);
  }
}

/** Triagem concluída: quem é, de onde, como classificou e o que parece ser. */
export function avisarNovoLead(dados: {
  nome: string;
  cidade: string;
  cor: Cor;
  produto: string | null;
}): void {
  void enviarModelo("lead_triagem", [
    dados.nome,
    dados.cidade,
    EMOJI[dados.cor],
    dados.produto ?? "a definir",
  ]).catch((e) => console.error("[aviso] falha ao avisar lead", e));
}

/** Saiu do bot no meio: alguém precisa assumir a conversa. */
export function avisarPedidoDeAtendente(dados: {
  nome: string;
  telefone: string;
  parouEm: string;
}): void {
  void enviarModelo("pedido_atendente", [
    dados.nome,
    dados.telefone,
    dados.parouEm,
  ]).catch((e) => console.error("[aviso] falha ao avisar pedido de atendente", e));
}
