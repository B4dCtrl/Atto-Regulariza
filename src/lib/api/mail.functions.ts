// src/lib/api/mail.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exigirAdmin } from "@/lib/api/exigir-admin.server";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { listar, abrir, baixarAnexo, gravarEmEnviados } from "@/lib/api/mail-imap.server";
import { montarEEnviar } from "@/lib/api/mail-smtp.server";
import { schemaListar, schemaAbrir, schemaAnexo, schemaEnviar } from "@/lib/mail/validacao";
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

export const listarEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaListar)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    return protegido(
      "listar",
      () => listar(data.pasta, data.pagina, data.alias),
      "Não foi possível abrir a caixa agora.",
    );
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
    return e;
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
    if (!a) throw new Error("Anexo não encontrado ou maior que 15 MB.");
    return a;
  });

export const enviarEmailDaCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaEnviar)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);

    const umaHoraAtras = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("mail_envios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("enviado_em", umaHoraAtras);
    if ((count ?? 0) >= ENVIOS_POR_HORA) {
      throw new Error("Limite de 30 envios por hora atingido. Tente mais tarde.");
    }

    // Os cabeçalhos da conversa vêm do e-mail original, lido no servidor —
    // nunca do navegador, que poderia forjar um Message-ID qualquer.
    let conversa: { inReplyTo?: string; references?: string[] } = {};
    if (data.respondendo) {
      const original = await protegido(
        "abrir original",
        () => abrir(data.respondendo!.pasta, data.respondendo!.uid),
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
