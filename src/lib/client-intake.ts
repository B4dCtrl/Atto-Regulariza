import { supabase } from "@/integrations/supabase/client";

/** Dados do intake do cliente (preenchidos no wizard). */
export type IntakeData = {
  nome:         string;
  email:        string;
  cidade:       string;
  estado:       string;
  tipo_imovel:  string;
  situacao:     string;
  objetivo:     string;
  urgencia:     string;
  nome_projeto: string;
};

/**
 * Cria perfil + imóvel + etapas do cliente DIRETO do navegador (usuário logado).
 * Funciona com as chaves públicas já configuradas — não depende de service role.
 * Idempotente: se o cliente já tem imóvel, não duplica.
 *
 * Requer a migração 20260622_cliente_cria_proprio_intake.sql (RLS permite o
 * cliente inserir o próprio imóvel/etapas).
 */
export async function createClientIntakeBrowser(uid: string, d: IntakeData): Promise<void> {
  // Idempotência
  const { data: existing } = await supabase
    .from("properties").select("id").eq("client_id", uid).limit(1).maybeSingle();
  if (existing) return;

  // Perfil
  await supabase.from("profiles").upsert({
    id: uid, name: d.nome, email: d.email, role: "cliente",
    city: d.cidade, state: d.estado,
  });

  // Imóvel (progress 0 / stage 0: sem andamento até a equipe dar o diagnóstico)
  const projectName = d.nome_projeto.trim() || `${d.nome} — ${d.situacao || "Regularização"}`;
  const { data: prop } = await supabase
    .from("properties")
    .insert({
      name: projectName, city: d.cidade, state: d.estado,
      client_id: uid, client_name: d.nome, client_email: d.email,
      tipo_imovel: d.tipo_imovel, situacao: d.situacao,
      objetivo: d.objetivo, urgencia: d.urgencia,
      status: "entrada", current_stage: 0, progress: 0,
    })
    .select("id").single();

  // Etapas
  if (prop?.id) {
    const LABELS = ["Cadastro", "Análise", "Profissional", "Tramitação", "Entrega"];
    await supabase.from("process_stages").insert(
      LABELS.map((label, i) => ({ property_id: prop.id, stage_number: i + 1, label, state: "pending" })),
    );
  }

  // Marca o lead como convertido (best-effort)
  await supabase.from("leads").update({ converted: true }).eq("email", d.email);
}
