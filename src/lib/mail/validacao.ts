import { z } from "zod";
import { ENDERECOS, PESSOAIS } from "./enderecos";
import { VISOES } from "./visoes";

/**
 * O que o navegador pode pedir às server functions da caixa.
 *
 * Validado nos dois lados: a tela usa estes schemas para avisar antes de
 * enviar, e o servidor para recusar o que chegar fora deles. Nome de pasta
 * IMAP nunca vem do navegador — só um destes dois apelidos.
 */
export const PASTAS = ["entrada", "enviados"] as const;
export type Pasta = (typeof PASTAS)[number];

// Compartilhado entre o servidor (`listar`) e a tela (`/admin/mail`), para as
// duas concordarem sobre quando mostrar o botão de "mais antigos".
export const POR_PAGINA = 50;

const uid = z.number().int().positive();

export const schemaListar = z.object({
  pasta: z.enum(PASTAS),
  pagina: z.number().int().min(0).max(1000),
  // Visão, não endereço: "contato@" como filtro batia em toda mensagem (o
  // `Delivered-To` da caixa onde os aliases entregam) — ver `buscaDaVisao`.
  visao: z.enum(VISOES),
});

export const schemaAbrir = z.object({ pasta: z.enum(PASTAS), uid });

/**
 * Message-ID como aparece no cabeçalho: `<parte-esquerda@parte-direita>`.
 *
 * É a chave de `mail_atribuicoes` e vira termo de busca IMAP, então só ASCII
 * visível, sem aspas, barra invertida nem `< >` no meio — o mesmo CHECK da
 * tabela. Nunca vem do navegador: o servidor lê da mensagem e valida aqui.
 */
export const schemaMessageId = z
  .string()
  .min(5)
  .max(500)
  .regex(/^[!-~]+$/)
  .regex(/^<[^<>"\\\s]+@[^<>"\\\s]+>$/);

// `null` desfaz a atribuição. Só as três pessoas: contato@/suporte@ não são
// "alguém" a quem entregar um e-mail.
export const schemaAtribuir = z.object({
  pasta: z.enum(PASTAS),
  uid,
  responsavel: z.enum(PESSOAIS).nullable(),
});

export const schemaAnexo = z.object({
  pasta: z.enum(PASTAS),
  uid,
  indice: z.number().int().min(0).max(100),
});

export const schemaEnviar = z.object({
  de: z.enum(ENDERECOS),
  para: z.array(z.string().trim().email()).min(1).max(10),
  // Quebra de linha no assunto é o caminho clássico para injetar cabeçalho.
  assunto: z
    .string()
    .trim()
    .max(200)
    .regex(/^[^\r\n]*$/),
  texto: z
    .string()
    .max(20_000)
    .refine((t) => t.trim().length > 0, "Escreva a mensagem."),
  respondendo: z.object({ pasta: z.enum(PASTAS), uid }).optional(),
});

export type EntradaEnviar = z.infer<typeof schemaEnviar>;
