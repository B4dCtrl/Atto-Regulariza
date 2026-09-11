/**
 * Exclusão da própria conta, pedida pelo titular.
 *
 * A "Zona de perigo" do perfil tinha o botão desde o começo, sem nenhuma ação.
 * Não era só uma ponta solta de interface: a LGPD dá ao titular o direito de
 * eliminação (art. 18), e um botão que promete e não cumpre é pior que a
 * ausência dele.
 *
 * **Anonimiza, não apaga.** Regularização gera documento com obrigação de
 * guarda — matrícula, planta, protocolo de prefeitura — e o processo pode
 * seguir vivo com o cartório depois que a pessoa sai. Apagar a linha levaria
 * junto o histórico de um processo que não é só dela. Então somem os dados que
 * identificam (nome, e-mail, telefone, CPF, cidade, bio, foto) e fica o
 * registro sem dono identificável.
 *
 * O acesso é cortado de verdade: o usuário do Auth é removido, então não há
 * como entrar de novo numa conta esvaziada.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarEmail } from "@/lib/api/email.server";

/** A palavra que a pessoa digita para confirmar. */
export const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

function htmlContaExcluida(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}. ` : "Olá. ";
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#153A40">
      <p>${ola}Sua conta na Ato Regulariza foi excluída, como você pediu.</p>
      <p>
        Seus dados pessoais — nome, e-mail, telefone e CPF — foram removidos do
        nosso sistema. Os documentos e registros dos processos de regularização
        permanecem arquivados sem ligação com você, porque a legislação exige
        que sejam guardados.
      </p>
      <p>
        Se você não pediu isso, responda este e-mail imediatamente.
      </p>
      <p style="color:#6b7280;font-size:13px">Ato Regulariza</p>
    </div>
  `;
}

export const excluirMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      // Conferida no servidor também: validar só no navegador deixaria a
      // exclusão a uma chamada de distância para quem abre o console.
      confirmacao: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (data.confirmacao.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
      throw new Error(`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`);
    }

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("name, email, role")
      .eq("id", context.userId)
      .maybeSingle();

    // Um admin que se exclui tranca o back office. Acontece por engano, e o
    // estrago é grande o bastante para valer a barreira.
    const { data: papeis } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (papeis?.some((r) => r.role === "admin")) {
      throw new Error(
        "Contas de administrador não podem ser excluídas por aqui. Fale com a equipe.",
      );
    }

    const nome = perfil?.name ?? "";
    const email = perfil?.email ?? "";

    // 1) Apaga a foto: fica num bucket de leitura pública e não é anonimizável.
    await supabaseAdmin.storage
      .from("avatares")
      .list(context.userId)
      .then(({ data: arquivos }) => {
        if (!arquivos?.length) return;
        return supabaseAdmin.storage
          .from("avatares")
          .remove(arquivos.map((a) => `${context.userId}/${a.name}`));
      })
      .catch(() => undefined);

    // 2) Anonimiza o perfil.
    const { error: erroPerfil } = await supabaseAdmin
      .from("profiles")
      .update({
        name: "Conta excluída",
        initials: "—",
        email: null,
        phone: null,
        cpf: null,
        city: null,
        state: null,
        bio: null,
        avatar_url: null,
        active: false,
        accepting: false,
      })
      .eq("id", context.userId);

    if (erroPerfil) {
      avisarErro("exclusão de conta", erroPerfil.message);
      throw new Error("Não foi possível excluir a conta agora. Tente de novo.");
    }

    // 3) Corta o acesso. Depois disto não há como entrar de novo.
    const { error: erroAuth } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (erroAuth) {
      avisarErro("exclusão de conta", `perfil anonimizado mas auth intacto: ${erroAuth.message}`);
      throw new Error("Conta parcialmente excluída. A equipe foi avisada.");
    }

    // 4) Avisa por e-mail. Se alguém excluiu a conta sem ser o dono, este é o
    //    único sinal que ele recebe — por isso vai depois de dar certo, e a
    //    falha aqui não desfaz nada.
    if (email) {
      await enviarEmail({
        para: email,
        assunto: "Sua conta na Ato Regulariza foi excluída",
        html: htmlContaExcluida(nome),
      });
    }

    return { ok: true };
  });
