// src/lib/api/mail-imap.server.ts
import process from "node:process";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import type { Pasta } from "@/lib/mail/validacao";
import { corpoParaExibir } from "@/lib/mail/limpar-html";
import { descobrirAlias, type Endereco } from "@/lib/mail/enderecos";

/**
 * A caixa contato@ na Hostinger, lida por IMAP.
 *
 * Uma conexão por chamada: serverless não guarda conexão aberta entre
 * requisições. Custa de 1 a 2 segundos por tela, e em troca nenhum e-mail
 * fica copiado no nosso banco.
 *
 * A senha só existe aqui, em variável de ambiente. Nunca vai para log: o
 * logger do imapflow fica desligado porque ele imprime o diálogo com o
 * servidor.
 */

const POR_PAGINA = 50;
const LIMITE_ANEXO = 15 * 1024 * 1024;
// Mensagem inteira acima disto não é baixada/parseada: só os cabeçalhos
// voltam, com um aviso no lugar do corpo. Protege a função serverless de
// gastar memória/tempo com um anexo enorme só para abrir a tela.
const LIMITE_ABERTURA = 25 * 1024 * 1024;

export type ResumoEmail = {
  uid: number;
  de: string;
  para: string[];
  assunto: string;
  data: string;
  lido: boolean;
  temAnexo: boolean;
  alias: Endereco;
};

export type EmailAberto = ResumoEmail & {
  html: string;
  texto: string;
  anexos: { indice: number; nome: string; tipo: string; tamanho: number }[];
  messageId?: string;
  references: string[];
  responderPara: string;
};

function cliente(): ImapFlow {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!user || !pass) throw new Error("MAIL_USER ou MAIL_PASSWORD ausente");
  return new ImapFlow({
    host: "imap.hostinger.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
}

/** Abre, executa e sempre fecha — inclusive quando dá erro no meio. */
async function comCaixa<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = cliente();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.logout().catch(() => c.close());
  }
}

/** Nome real da pasta. O de Enviados muda de servidor para servidor. */
async function caminho(c: ImapFlow, pasta: Pasta): Promise<string> {
  if (pasta === "entrada") return "INBOX";
  const caixas = await c.list();
  const enviados = caixas.find((b) => b.specialUse === "\\Sent");
  if (!enviados) throw new Error("pasta de Enviados não encontrada");
  return enviados.path;
}

function enderecos(a: AddressObject | AddressObject[] | undefined): string[] {
  const lista = Array.isArray(a) ? a : a ? [a] : [];
  return lista.flatMap((x) => x.value.map((v) => v.address ?? "")).filter(Boolean);
}

export async function listar(
  pasta: Pasta,
  pagina: number,
  alias?: Endereco,
): Promise<{ itens: ResumoEmail[]; total: number }> {
  return comCaixa(async (c) => {
    const lock = await c.getMailboxLock(await caminho(c, pasta));
    try {
      const busca = alias
        ? { or: [{ to: alias }, { cc: alias }, { header: { "delivered-to": alias } }] }
        : { all: true };
      const uids = ((await c.search(busca, { uid: true })) || []).sort((a, b) => b - a);
      const pagUids = uids.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
      if (pagUids.length === 0) return { itens: [], total: uids.length };

      const itens: ResumoEmail[] = [];
      for await (const m of c.fetch(
        pagUids.join(","),
        {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          internalDate: true,
          headers: ["delivered-to"],
        },
        { uid: true },
      )) {
        const env = m.envelope;
        const para = (env?.to ?? []).map((x) => x.address ?? "").filter(Boolean);
        const cc = (env?.cc ?? []).map((x) => x.address ?? "").filter(Boolean);
        const deliveredTo = m.headers
          ? [...m.headers.toString().matchAll(/delivered-to:\s*(\S+)/gi)].map((r) => r[1])
          : [];
        itens.push({
          uid: m.uid,
          de: env?.from?.[0]?.name || env?.from?.[0]?.address || "(sem remetente)",
          para,
          assunto: env?.subject || "(sem assunto)",
          data: new Date(m.internalDate ?? env?.date ?? new Date()).toISOString(),
          lido: m.flags?.has("\\Seen") ?? false,
          temAnexo: JSON.stringify(m.bodyStructure ?? {}).includes('"disposition":"attachment"'),
          alias: descobrirAlias({ to: para, cc, deliveredTo }),
        });
      }
      itens.sort((a, b) => b.uid - a.uid);
      return { itens, total: uids.length };
    } finally {
      lock.release();
    }
  });
}

export async function abrir(pasta: Pasta, uid: number): Promise<EmailAberto | null> {
  return comCaixa(async (c) => {
    const lock = await c.getMailboxLock(await caminho(c, pasta));
    try {
      // Checagem leve antes de baixar: uma mensagem gigante (vídeo anexado
      // etc.) não deve ser inteiramente baixada/parseada só para abrir a
      // tela — isso estouraria tempo/memória da função serverless.
      const resumo = await c.fetchOne(
        String(uid),
        { uid: true, envelope: true, flags: true, size: true },
        { uid: true },
      );
      if (!resumo) return null;

      const env = resumo.envelope;
      const para = (env?.to ?? []).map((x) => x.address ?? "").filter(Boolean);
      const cc = (env?.cc ?? []).map((x) => x.address ?? "").filter(Boolean);
      const base: ResumoEmail = {
        uid,
        de: env?.from?.[0]?.name || env?.from?.[0]?.address || "(sem remetente)",
        para,
        assunto: env?.subject || "(sem assunto)",
        data: new Date(resumo.internalDate ?? env?.date ?? new Date()).toISOString(),
        lido: true,
        temAnexo: false,
        alias: descobrirAlias({ to: para, cc }),
      };

      if ((resumo.size ?? 0) > LIMITE_ABERTURA) {
        await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        return {
          ...base,
          html: corpoParaExibir({
            text: "Esta mensagem é grande demais para abrir aqui. Acesse o webmail da Hostinger para vê-la.",
            anexos: [],
          }),
          texto: "",
          anexos: [],
          references: [],
          responderPara: env?.from?.[0]?.address ?? "",
        };
      }

      const baixado = await c.download(String(uid), undefined, { uid: true });
      if (!baixado) return null;
      const e = await simpleParser(baixado.content);
      await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

      const paraCompleto = enderecos(e.to);
      const ccCompleto = enderecos(e.cc);
      const dt = e.headers.get("delivered-to");
      const deliveredTo = (Array.isArray(dt) ? dt : dt ? [dt] : []).map(String);
      const anexosReais = e.attachments.filter((a) => a.contentDisposition === "attachment");
      const refs = e.references
        ? Array.isArray(e.references)
          ? e.references
          : [e.references]
        : [];
      const deQuem = e.from?.value[0];

      return {
        uid,
        de: e.from?.text ?? "(sem remetente)",
        para: paraCompleto,
        assunto: e.subject ?? "(sem assunto)",
        data: (e.date ?? new Date()).toISOString(),
        lido: true,
        temAnexo: anexosReais.length > 0,
        alias: descobrirAlias({ to: paraCompleto, cc: ccCompleto, deliveredTo }),
        html: corpoParaExibir({
          html: e.html,
          text: e.text,
          anexos: e.attachments.map((a) => ({
            cid: a.cid,
            contentType: a.contentType,
            content: a.content,
          })),
        }),
        texto: e.text ?? "",
        anexos: e.attachments
          .map((a, indice) => ({ a, indice }))
          .filter(({ a }) => a.contentDisposition === "attachment")
          .map(({ a, indice }) => ({
            indice,
            nome: a.filename ?? `anexo-${indice + 1}`,
            tipo: a.contentType,
            tamanho: a.size,
          })),
        messageId: e.messageId,
        references: refs,
        responderPara: e.replyTo?.value[0]?.address ?? deQuem?.address ?? "",
      };
    } finally {
      lock.release();
    }
  });
}

export async function baixarAnexo(
  pasta: Pasta,
  uid: number,
  indice: number,
): Promise<{ nome: string; base64: string } | null> {
  return comCaixa(async (c) => {
    const lock = await c.getMailboxLock(await caminho(c, pasta));
    try {
      const baixado = await c.download(String(uid), undefined, { uid: true });
      if (!baixado) return null;
      const e = await simpleParser(baixado.content);
      const a = e.attachments[indice];
      if (!a || a.size > LIMITE_ANEXO) return null;
      return { nome: a.filename ?? `anexo-${indice + 1}`, base64: a.content.toString("base64") };
    } finally {
      lock.release();
    }
  });
}

/**
 * Cópia em Enviados.
 *
 * Envio por SMTP externo não aparece sozinho nos Enviados da Hostinger; sem
 * isto, a resposta dada pelo painel não existiria no webmail nem no celular.
 */
export async function gravarEmEnviados(bruto: Buffer): Promise<void> {
  await comCaixa(async (c) => {
    await c.append(await caminho(c, "enviados"), bruto, ["\\Seen"]);
  });
}
