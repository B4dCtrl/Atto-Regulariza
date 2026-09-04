import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarEmail, htmlBoasVindasProfissional } from "@/lib/api/email.server";

export const createProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      council: z.string().optional().default(""),
      registro: z.string().optional().default(""),
      specialties: z.array(z.string()).optional().default([]),
      regions: z.array(z.string()).optional().default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    // Só admin pode criar contas de profissional
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores podem cadastrar profissionais.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, role: "profissional" },
    });
    if (error || !created.user) {
      // "User already registered" é a única mensagem do Supabase que ajuda quem
      // está na tela — as outras expõem detalhe interno sem valor para o admin.
      const jaExiste = /already/i.test(error?.message ?? "");
      throw new Error(
        jaExiste
          ? "Já existe uma conta com este e-mail."
          : "Não foi possível criar a conta do profissional.",
      );
    }

    const uid = created.user.id;
    const initials = data.name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    // Criado pelo admin no painel: já nasce aprovado. O cadastro público é que
    // entra como 'pendente' e passa pela fila de aprovação.
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: uid,
      name: data.name,
      email: data.email,
      initials,
      role: "profissional",
      approval_status: "aprovado",
      // A senha foi gerada aqui e repassada por fora do sistema. Até ser
      // trocada, ela é conhecida por mais de uma pessoa — o painel exige a
      // troca antes de qualquer outra coisa.
      senha_provisoria: true,
      council: data.council,
      registro: data.registro,
      specialties: data.specialties,
      regions: data.regions,
      specialization: `${data.council} ${data.registro}`.trim(),
    });
    if (pErr) {
      // Desfaz a criação no auth.
      //
      // Sem isto o usuário fica pela metade: existe para autenticação, mas o
      // perfil não gravou. O admin vê o erro, tenta de novo e leva
      // "já existe uma conta com este e-mail" — o endereço fica queimado sem
      // que ninguém entenda o motivo. Preferimos voltar ao estado anterior e
      // deixar o admin repetir a operação.
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {
        // Se nem desfazer deu certo, não há o que fazer aqui — o log da Vercel
        // guarda o motivo.
      });

      console.error("[createProfessional] upsert do perfil falhou:", pErr);
      avisarErro("cadastro de profissional", pErr);

      // Coluna que não existe (42703) significa código novo contra banco
      // velho: alguma migração não foi aplicada. Repetir a operação não
      // resolve, e "tente de novo" mandaria procurar no lugar errado.
      const faltaMigracao =
        pErr.code === "42703" || /column .* does not exist/i.test(pErr.message ?? "");

      throw new Error(
        faltaMigracao
          ? "O banco está desatualizado em relação ao site: falta aplicar uma migração. " +
            `Nenhuma conta foi criada. (${pErr.message})`
          : "Não foi possível salvar o perfil. Nenhuma conta foi criada; tente de novo.",
      );
    }

    // Boas-vindas. Não leva a senha: e-mail e senha no mesmo canal significa que
    // quem interceptar a mensagem entra na conta.
    //
    // O envio NÃO derruba a criação. A conta já existe e o admin tem a senha
    // provisória na tela; se o e-mail falhar, ele repassa e a pessoa entra do
    // mesmo jeito. Devolvemos o aviso para a tela dizer a verdade.
    const envio = await enviarEmail({
      para: data.email,
      assunto: "Sua conta na Ato Regulariza",
      html: htmlBoasVindasProfissional({
        nome: data.name,
        urlEntrar: "https://www.atoregulariza.com.br/entrar",
      }),
    });

    return { id: uid, emailEnviado: envio.ok, motivoEmail: envio.ok ? null : envio.motivo };
  });

/**
 * Apaga a conta de um profissional.
 *
 * Recusa quem ainda tem processo atribuído, e não por precaução vaga:
 * `properties.assigned_professional_id` referencia `auth.users(id)` SEM
 * `ON DELETE`, então o banco recusaria a exclusão com um erro de chave
 * estrangeira que não diz nada a quem clicou. Melhor explicar antes.
 *
 * O que fica: `pendencies.criada_por` e `process_notes.autor_id` são
 * `ON DELETE SET NULL` — o histórico do trabalho permanece, só perde o nome do
 * autor. `profiles` cai em cascata junto com o usuário.
 *
 * Para tirar alguém de circulação sem perder o rastro, o caminho é desativar,
 * não excluir.
 */
export const deleteProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores podem excluir profissionais.");
    }

    // Um admin apagando a própria conta se tranca para fora do back office.
    if (data.id === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", data.id)
      .maybeSingle();
    if (!perfil) throw new Error("Profissional não encontrado.");
    if (perfil.role !== "profissional") {
      throw new Error("Esta conta não é de profissional.");
    }

    const { count } = await supabaseAdmin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("assigned_professional_id", data.id);

    if ((count ?? 0) > 0) {
      throw new Error(
        `Este profissional está em ${count} processo(s). Reatribua os processos antes de excluir, ou apenas desative a conta.`,
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Não foi possível excluir a conta.");

    return { ok: true };
  });
