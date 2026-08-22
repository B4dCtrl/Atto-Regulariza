import process from "node:process";

/**
 * Envio de e-mail transacional pela API do Resend.
 *
 * Existe separado do SMTP que o Supabase usa. O Supabase manda os e-mails DELE
 * — confirmação de cadastro, redefinição de senha — pelos modelos dele. Este
 * módulo manda os NOSSOS, com texto e momento que a gente decide.
 *
 * A chave nunca chega ao navegador: só é lida em server function.
 */

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Remetente. Precisa estar no domínio verificado no Resend, senão a API recusa.
 * Configurável por ambiente para não exigir mudança de código se o endereço
 * mudar.
 */
const REMETENTE = process.env.EMAIL_REMETENTE || "Ato Regulariza <contato@atoregulariza.com.br>";

export type ResultadoEnvio = { ok: true } | { ok: false; motivo: string };

/**
 * Manda um e-mail. Nunca lança.
 *
 * Quem chama está no meio de uma operação que já deu certo — criar a conta do
 * profissional, por exemplo. Falhar o envio não pode desfazer o que já
 * aconteceu nem derrubar a resposta; o chamador decide o que dizer na tela.
 */
export async function enviarEmail(p: {
  para: string;
  assunto: string;
  html: string;
}): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY ausente — e-mail não enviado");
    return { ok: false, motivo: "Envio de e-mail não configurado no servidor." };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      // Prazo curto: e-mail é efeito colateral de uma operação que o usuário
      // está esperando na tela. Melhor avisar que não saiu do que travar.
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: [p.para],
        subject: p.assunto,
        html: p.html,
      }),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      console.error("[email] Resend recusou", res.status, corpo.slice(0, 300));
      return { ok: false, motivo: "O provedor de e-mail recusou o envio." };
    }

    return { ok: true };
  } catch (e) {
    console.error("[email] falha ao enviar:", e);
    return { ok: false, motivo: "Não foi possível enviar o e-mail agora." };
  }
}

/** Escapa o que vier do banco antes de entrar no HTML do e-mail. */
function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Boas-vindas ao profissional cadastrado pela equipe.
 *
 * **Não traz a senha.** Ela vai pelo canal que o admin escolher — e-mail e
 * senha no mesmo lugar significa que quem interceptar a mensagem entra na
 * conta. O e-mail diz que a senha chega separada e que a troca é obrigatória
 * no primeiro acesso.
 */
export function htmlBoasVindasProfissional(p: { nome: string; urlEntrar: string }): string {
  const nome = esc(p.nome);
  const url = esc(p.urlEntrar);

  return `<div style="margin:0;padding:0;background:#F1EEE9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EEE9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FAFAF7;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,26,26,0.06);">

  <tr>
    <td style="background:#FFFFFF;padding:28px 32px 22px;">
      <img src="https://www.atoregulariza.com.br/ato-lockup.png" alt="Ato Regulariza" width="128" style="display:block;border:0;max-width:128px;height:auto;">
      <div style="color:#6B6660;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:12px;">Regularização de imóveis</div>
    </td>
  </tr>

  <tr><td style="height:4px;background:#E1662E;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:36px 32px 32px;">
      <h1 style="font-size:23px;line-height:1.3;color:#1A1A1A;margin:0 0 14px;font-weight:600;">Bem-vindo, ${nome}</h1>

      <p style="font-size:15px;line-height:1.65;color:#6B6660;margin:0 0 20px;">
        Sua conta de profissional na Ato Regulariza foi criada pela nossa equipe. Por ela você
        acompanha os processos que forem atribuídos a você, recebe os documentos do cliente e
        registra cada etapa do trabalho.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#1A1A1A;">
        <a href="${url}" style="display:inline-block;padding:14px 30px;color:#FAFAF7;text-decoration:none;font-size:15px;font-weight:500;border-radius:999px;">Acessar meu painel</a>
      </td></tr></table>

      <div style="height:1px;background:#E5E1DC;margin:28px 0;"></div>

      <p style="font-size:14px;line-height:1.65;color:#6B6660;margin:0 0 12px;">
        <strong style="color:#1A1A1A;">Sua senha chega separada.</strong> Por segurança, ela não
        vem neste e-mail — a equipe repassa por outro canal. Assim, quem porventura tiver acesso
        a esta mensagem não tem acesso à sua conta.
      </p>

      <p style="font-size:14px;line-height:1.65;color:#6B6660;margin:0;">
        <strong style="color:#1A1A1A;">No primeiro acesso você cria a sua própria senha.</strong>
        O painel pede a troca antes de qualquer outra coisa, e a senha provisória deixa de valer.
      </p>

      <div style="height:1px;background:#E5E1DC;margin:28px 0;"></div>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:0;">
        Não esperava este e-mail? Responda avisando e nós removemos a conta.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#F1EEE9;padding:18px 32px;text-align:center;">
      <div style="font-size:12px;color:#6B6660;">Ato Regulariza · Regularização de imóveis</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</div>`;
}
