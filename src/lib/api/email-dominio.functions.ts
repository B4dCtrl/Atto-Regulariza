import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dominioDoEmail } from "@/lib/email-dominio";

/**
 * O domínio do e-mail recebe e-mail? Confere se ele tem servidor de e-mail
 * (registro MX) antes de criar a conta.
 *
 * Sem isto, um e-mail com domínio digitado errado criava a conta mesmo assim:
 * o link de confirmação nunca chegava, e no caso do profissional o cadastro
 * ia parar na fila de aprovação do admin.
 *
 * Pela consulta DNS sobre HTTPS da Cloudflare, e não pelo `dns` do Node: lá
 * "domínio não existe" é uma resposta explícita (Status 3), enquanto o
 * resolvedor local responde ENOTFOUND também quando a própria rede falha — e
 * aí barraríamos todo mundo.
 *
 * Pública de propósito: roda antes de existir conta. Só consulta DNS público
 * e devolve sim/não.
 *
 * `recebe: null` = não deu para saber. Quem chama deixa seguir: uma falha
 * nossa não pode impedir alguém de se cadastrar.
 */
export const dominioRecebeEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().max(320) }))
  .handler(async ({ data }): Promise<{ dominio: string | null; recebe: boolean | null }> => {
    const dominio = dominioDoEmail(data.email);
    if (!dominio) return { dominio: null, recebe: false };

    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dominio)}&type=MX`,
        { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(3000) },
      );
      if (!res.ok) return { dominio, recebe: null };
      const corpo = (await res.json()) as { Status?: number; Answer?: { type?: number }[] };

      // 3 = o domínio não existe.
      if (corpo.Status === 3) return { dominio, recebe: false };
      if (corpo.Status !== 0) return { dominio, recebe: null };
      // Existe, mas sem servidor de e-mail (tipo 15 = MX).
      return { dominio, recebe: (corpo.Answer ?? []).some((a) => a.type === 15) };
    } catch {
      return { dominio, recebe: null };
    }
  });
