// src/lib/api/mail.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exigirAdmin } from "@/lib/api/exigir-admin.server";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import {
  listar,
  abrir,
  baixarAnexo,
  cabecalhosDoOriginal,
  gravarEmEnviados,
  type EmailAberto,
} from "@/lib/api/mail-imap.server";
import { atribuicoesDe, gravarAtribuicao, idsAtribuidosA } from "@/lib/api/mail-atribuicoes.server";
import { montarEEnviar } from "@/lib/api/mail-smtp.server";
import { baixarImagens } from "@/lib/api/mail-imagens.server";
import {
  schemaListar,
  schemaAbrir,
  schemaAnexo,
  schemaAtribuir,
  schemaEnviar,
  schemaMessageId,
} from "@/lib/mail/validacao";
import { ehPessoal, type Pessoal } from "@/lib/mail/enderecos";
import { visaoPadrao, type Visao } from "@/lib/mail/visoes";
import { cabecalhosDeResposta } from "@/lib/mail/resposta";

/**
 * A caixa de e-mail do painel.
 *
 * `exigirAdmin` é sempre a primeira linha: nenhuma conexão com a Hostinger é
 * aberta antes de saber que quem pediu é admin. O que der errado depois vira
 * mensagem genérica para a tela e detalhe no sino — o detalhe pode conter
 * endereço de servidor e trecho de resposta do IMAP, que não é da conta do
 * navegador.
 */

const ENVIOS_POR_HORA = 30;

async function protegido<T>(origem: string, fn: () => Promise<T>, mensagem: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[mail] ${origem}`, (e as Error).message);
    await avisarErro(`caixa de e-mail: ${origem}`, e);
    throw new Error(mensagem);
  }
}

/**
 * Etiquetas "com Taís". Falha do banco aqui não derruba a tela: a lista (ou o
 * e-mail) sai sem etiqueta e o detalhe vai para o sino — a caixa continua
 * utilizável com o Supabase fora do ar.
 */
async function etiquetas(ids: (string | undefined)[]): Promise<Map<string, Pessoal>> {
  try {
    return await atribuicoesDe(ids.filter((id): id is string => !!id));
  } catch (e) {
    await avisarErro("caixa de e-mail: ler atribuições", e);
    return new Map();
  }
}

async function comEtiqueta(e: EmailAberto): Promise<EmailAberto> {
  const mapa = await etiquetas([e.messageId]);
  return { ...e, atribuido: (e.messageId && mapa.get(e.messageId)) || null };
}

/**
 * Com que visão a caixa abre para quem está logado.
 *
 * Decidido aqui, pelo e-mail do `auth.users` (que o usuário não edita), e não
 * pelo navegador. É só o ponto de partida: a tela deixa trocar de visão.
 */
export const minhaCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Nada vem do navegador: a entrada é vazia de propósito.
  .inputValidator(z.object({}).strict().optional())
  .handler(async ({ context }): Promise<{ visao: Visao }> => {
    await exigirAdmin(context.userId);
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    // Sem o e-mail, "Todos": é admin, e abrir na caixa errada de outra pessoa
    // seria pior do que abrir na caixa inteira.
    if (error) return { visao: "todos" };
    return { visao: visaoPadrao(u.user?.email) };
  });

export const listarEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaListar)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    // Visão de pessoa = mandado ao alias + atribuído a ela. Sem conseguir ler
    // as atribuições, a lista não sai: mostrar a caixa da Taís sem o que foi
    // passado a ela esconderia trabalho sem ninguém perceber.
    const visao = data.visao;
    const atribuidos = ehPessoal(visao)
      ? await protegido(
          "atribuições da visão",
          () => idsAtribuidosA(visao),
          "Não foi possível abrir a caixa agora.",
        )
      : [];
    const r = await protegido(
      "listar",
      () => listar(data.pasta, data.pagina, visao, atribuidos),
      "Não foi possível abrir a caixa agora.",
    );
    const mapa = await etiquetas(r.itens.map((m) => m.messageId));
    return {
      total: r.total,
      itens: r.itens.map((m) => ({
        ...m,
        atribuido: (m.messageId && mapa.get(m.messageId)) || null,
      })),
    };
  });

export const abrirEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaAbrir)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const e = await protegido(
      "abrir",
      () => abrir(data.pasta, data.uid),
      "Não foi possível abrir este e-mail.",
    );
    if (!e) throw new Error("E-mail não encontrado.");
    return comEtiqueta(e);
  });

/**
 * "Atribuir a…": passa o e-mail para uma pessoa, troca ou (com `null`) tira.
 *
 * A tela só diz QUAL e-mail (pasta + UID); o Message-ID que vira chave é lido
 * aqui, da própria mensagem na Hostinger. Se viesse do navegador, dava para
 * gravar atribuição de um id qualquer — inclusive um que casasse com outras
 * mensagens na busca da visão. Sem Message-ID válido, não há o que atribuir.
 */
export const atribuirEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaAtribuir)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const original = await protegido(
      "atribuir: ler o e-mail",
      () => cabecalhosDoOriginal(data.pasta, data.uid),
      "Não foi possível atribuir este e-mail.",
    );
    if (!original) throw new Error("E-mail não encontrado.");
    const id = schemaMessageId.safeParse(original.messageId);
    if (!id.success) {
      throw new Error("Este e-mail não tem um identificador válido — não dá para atribuir.");
    }
    await protegido(
      "atribuir: gravar",
      () => gravarAtribuicao(id.data, data.responsavel, context.userId),
      "Não foi possível atribuir este e-mail.",
    );
    return { atribuido: data.responsavel };
  });

// "Mostrar imagens". As URLs saem do e-mail lido aqui no servidor, nunca do
// navegador: a tela só diz qual e-mail, então não há como pedir ao servidor
// que busque um endereço arbitrário. Sem tabela de limite por hora (como a de
// envios): quem chama já é admin, e cada chamada tem teto próprio — 20
// imagens, 1 MB cada, 2 MB no total, 8 s — o que não dá para transformar em
// ataque de volume contra terceiros.
export const abrirEmailComImagens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaAbrir)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const e = await protegido(
      "abrir com imagens",
      () => abrir(data.pasta, data.uid, { imagens: baixarImagens }),
      "Não foi possível carregar as imagens deste e-mail.",
    );
    if (!e) throw new Error("E-mail não encontrado.");
    return comEtiqueta(e);
  });

export const baixarAnexoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaAnexo)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const a = await protegido(
      "anexo",
      () => baixarAnexo(data.pasta, data.uid, data.indice),
      "Não foi possível baixar o anexo.",
    );
    if (!a)
      throw new Error("Anexo não encontrado ou maior que 3 MB — abra pelo webmail da Hostinger.");
    return a;
  });

export const enviarEmailDaCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaEnviar)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);

    const umaHoraAtras = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error: erroLimite } = await supabaseAdmin
      .from("mail_envios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("enviado_em", umaHoraAtras);
    // Falha ao contar não pode virar "sem limite": na dúvida, fecha — mesma
    // regra de `exigirAdmin`.
    if (erroLimite) {
      await avisarErro("caixa de e-mail: limite de envio", erroLimite.message);
      throw new Error("Não foi possível enviar agora. Tente de novo.");
    }
    if ((count ?? 0) >= ENVIOS_POR_HORA) {
      throw new Error("Limite de 30 envios por hora atingido. Tente mais tarde.");
    }

    // Os cabeçalhos da conversa vêm do e-mail original, lido no servidor —
    // nunca do navegador, que poderia forjar um Message-ID qualquer.
    let conversa: { inReplyTo?: string; references?: string[] } = {};
    if (data.respondendo) {
      const original = await protegido(
        "cabeçalhos do original",
        () => cabecalhosDoOriginal(data.respondendo!.pasta, data.respondendo!.uid),
        "Não foi possível abrir o e-mail respondido.",
      );
      if (original) conversa = cabecalhosDeResposta(original);
    }

    // Só os campos que `montarEEnviar` espera: `data` também carrega
    // `respondendo`, que não é dela — passar por extenso evita que um campo
    // futuro em `data` vaze para dentro do e-mail sem querer.
    const { bruto } = await protegido(
      "enviar",
      () =>
        montarEEnviar({
          de: data.de,
          para: data.para,
          assunto: data.assunto,
          texto: data.texto,
          ...conversa,
        }),
      "O e-mail não foi enviado. Tente de novo.",
    );

    // Daqui em diante o e-mail já saiu: falha em registrar não pode dizer à
    // tela que o envio falhou, senão alguém reenvia e o cliente recebe dois.
    await gravarEmEnviados(bruto).catch((e) => avisarErro("caixa de e-mail: gravar enviado", e));
    const { error } = await supabaseAdmin.from("mail_envios").insert({
      user_id: context.userId,
      de: data.de,
      para: data.para,
      assunto: data.assunto,
      respondendo_message_id: conversa.inReplyTo ?? null,
    });
    if (error) await avisarErro("caixa de e-mail: registrar envio", error.message);

    return { ok: true as const };
  });
