// src/lib/api/mail-smtp.server.ts
import process from "node:process";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ROTULO, type Endereco } from "@/lib/mail/enderecos";

/**
 * Envio pela Hostinger.
 *
 * A mensagem é montada uma vez, crua, e a mesma cópia vai para o SMTP e para
 * a pasta Enviados — assim o que ficou registrado é exatamente o que saiu.
 * O login é sempre o do contato@; o alias só muda o `From`, o que a Hostinger
 * permite para aliases da própria caixa.
 */
export async function montarEEnviar(o: {
  de: Endereco;
  para: string[];
  assunto: string;
  texto: string;
  inReplyTo?: string;
  references?: string[];
}): Promise<{ bruto: Buffer; messageId: string }> {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!user || !pass) throw new Error("MAIL_USER ou MAIL_PASSWORD ausente");

  const nome =
    o.de === "contato@atoregulariza.com.br" || o.de === "suporte@atoregulariza.com.br"
      ? "Ato Regulariza"
      : `${ROTULO[o.de]} · Ato Regulariza`;

  const composer = new MailComposer({
    from: { name: nome, address: o.de },
    to: o.para,
    subject: o.assunto,
    text: o.texto,
    inReplyTo: o.inReplyTo,
    references: o.references,
  });
  const no = composer.compile();
  const bruto = await no.build();
  const messageId = no.messageId();

  const transporte = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transporte.sendMail({ envelope: { from: o.de, to: o.para }, raw: bruto });

  return { bruto, messageId };
}
