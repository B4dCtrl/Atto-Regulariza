import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
        // Se nem desfazer deu certo, não há o que fazer aqui — a mensagem
        // abaixo já manda procurar suporte, e o log da Vercel guarda o resto.
      });
      throw new Error("Não foi possível salvar o perfil. Nenhuma conta foi criada; tente de novo.");
    }

    return { id: uid };
  });
