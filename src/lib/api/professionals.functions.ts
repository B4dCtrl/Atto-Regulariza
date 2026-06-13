import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    council: z.string().optional().default(""),
    registro: z.string().optional().default(""),
    specialties: z.array(z.string()).optional().default([]),
    regions: z.array(z.string()).optional().default([]),
  }))
  .handler(async ({ data, context }) => {
    // Só admin pode criar contas de profissional
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores podem cadastrar profissionais.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, role: "profissional" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

    const uid = created.user.id;
    const initials = data.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: uid, name: data.name, email: data.email, initials,
      role: "profissional",
      council: data.council, registro: data.registro,
      specialties: data.specialties, regions: data.regions,
      specialization: `${data.council} ${data.registro}`.trim(),
    });
    if (pErr) throw new Error(pErr.message);

    return { id: uid };
  });
