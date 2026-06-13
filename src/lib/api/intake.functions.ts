import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cria o intake do cliente (perfil + imóvel + etapas) no servidor, com service
 * role. Necessário porque:
 *  - properties_insert (RLS) só permite admin inserir imóvel;
 *  - com confirmação de e-mail ligada, NÃO há sessão no momento do cadastro.
 *
 * Segurança: valida que o userId existe e que o e-mail bate com o do usuário
 * recém-criado (evita criar processos para ids arbitrários). Idempotente: se o
 * cliente já tem imóvel, retorna o existente.
 */
export const createClientIntake = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    userId:       z.string().uuid(),
    email:        z.string().email(),
    nome:         z.string().min(1),
    cidade:       z.string().optional().default(""),
    estado:       z.string().optional().default(""),
    tipo_imovel:  z.string().optional().default(""),
    situacao:     z.string().optional().default(""),
    objetivo:     z.string().optional().default(""),
    urgencia:     z.string().optional().default(""),
    nome_projeto: z.string().optional().default(""),
  }))
  .handler(async ({ data }) => {
    // 1) Confere que o usuário existe e o e-mail confere
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!u?.user || (u.user.email ?? "").toLowerCase() !== data.email.toLowerCase()) {
      throw new Error("Usuário inválido para este cadastro.");
    }

    // 2) Idempotência: já existe imóvel para este cliente?
    const { data: existing } = await supabaseAdmin
      .from("properties").select("id").eq("client_id", data.userId).limit(1).maybeSingle();
    if (existing) return { propertyId: existing.id };

    // 3) Perfil do cliente
    await supabaseAdmin.from("profiles").upsert({
      id: data.userId, name: data.nome, email: data.email, role: "cliente",
      city: data.cidade, state: data.estado,
    });

    // 4) Imóvel (progress 0 / stage 0: sem andamento até a equipe dar o diagnóstico)
    const projectName = data.nome_projeto.trim() || `${data.nome} — ${data.situacao || "Regularização"}`;
    const { data: prop, error } = await supabaseAdmin
      .from("properties")
      .insert({
        name: projectName, city: data.cidade, state: data.estado,
        client_id: data.userId, client_name: data.nome, client_email: data.email,
        tipo_imovel: data.tipo_imovel, situacao: data.situacao,
        objetivo: data.objetivo, urgencia: data.urgencia,
        status: "entrada", current_stage: 0, progress: 0,
      })
      .select("id").single();
    if (error || !prop) throw new Error(error?.message ?? "Falha ao criar processo.");

    // 5) Etapas (todas pendentes)
    const LABELS = ["Cadastro", "Análise", "Profissional", "Tramitação", "Entrega"];
    await supabaseAdmin.from("process_stages").insert(
      LABELS.map((label, i) => ({ property_id: prop.id, stage_number: i + 1, label, state: "pending" })),
    );

    // 6) Marca o lead como convertido
    await supabaseAdmin.from("leads").update({ converted: true }).eq("email", data.email);

    return { propertyId: prop.id };
  });
