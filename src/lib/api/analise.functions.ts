import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MODELO_IA, aceitaEsforco } from "@/lib/api/modelo-ia";

export type SugestaoDocumento = {
  id: string;
  kind: string;
  nome: string;
  aprovar: boolean;
  motivo: string;
};

export type SugestaoPendencia = { kind: string; descricao: string };

export type Analise = {
  processo: {
    id: string;
    nome: string;
    tipo: string | null;
    situacao: string | null;
    objetivo: string | null;
    cidade: string | null;
    uf: string | null;
    cliente: string | null;
  };
  documentos: SugestaoDocumento[];
  pendencias: SugestaoPendencia[];
  parecer: string;
  /** Preenchido quando a IA falhou. A tela abre mesmo assim, sem sugestão. */
  erroIA?: string;
};

const SYSTEM_PROMPT = `Você prepara a análise documental da Ato Regulariza, plataforma brasileira de regularização imobiliária. Quem decide é uma pessoa da equipe; você adianta o trabalho dela.

Recebe os dados de um processo e a lista de documentos que o cliente enviou — apenas tipo, nome do arquivo e data. Você NÃO vê o conteúdo dos arquivos.

Devolva:
- para cada documento, se sugere APROVAR e por quê, em uma linha. Como não vê o conteúdo, aprove quando o tipo enviado faz sentido para o caso, e recuse quando o tipo é claramente incompatível.
- as pendências que costumam faltar para esse perfil de caso. Use APENAS estes tipos: matricula, iptu, identidade, comprovante_endereco, planta, habite_se, ccir_car, outro.
- um parecer de no máximo 3 frases, escrito para a equipe.

REGRAS:
- Não invente documento que não esteja na lista.
- Não peça o que já foi enviado.
- A descrição da pendência é lida pelo CLIENTE: escreva direto, sem jargão, dizendo o que ele precisa providenciar.
- Escreva em português do Brasil, sem markdown e sem emoji.`;

const FORMATO_ANALISE = {
  type: "object",
  properties: {
    documentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "O id do documento, copiado da entrada." },
          aprovar: { type: "boolean" },
          motivo: { type: "string" },
        },
        required: ["id", "aprovar", "motivo"],
        additionalProperties: false,
      },
    },
    pendencias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "matricula",
              "iptu",
              "identidade",
              "comprovante_endereco",
              "planta",
              "habite_se",
              "ccir_car",
              "outro",
            ],
          },
          descricao: { type: "string" },
        },
        required: ["kind", "descricao"],
        additionalProperties: false,
      },
    },
    parecer: { type: "string" },
  },
  required: ["documentos", "pendencias", "parecer"],
  additionalProperties: false,
} as const;

/** Confere que quem chamou é admin. Papel vem do banco, nunca do cliente. */
async function exigirAdmin(userId: string): Promise<void> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Apenas administradores analisam processos.");
  }
}

export const sugerirAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<Analise> => {
    await exigirAdmin(context.userId);

    const { data: prop } = await supabaseAdmin
      .from("properties")
      .select("id, name, tipo_imovel, situacao, objetivo, city, state, client_name")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (!prop) throw new Error("Processo não encontrado.");

    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("id, kind, name, created_at")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null)
      .order("created_at");

    const processo = {
      id: prop.id,
      nome: prop.name,
      tipo: prop.tipo_imovel,
      situacao: prop.situacao,
      objetivo: prop.objetivo,
      cidade: prop.city,
      uf: prop.state,
      cliente: prop.client_name,
    };

    const documentosBase: SugestaoDocumento[] = (docs ?? []).map((d) => ({
      id: d.id,
      kind: d.kind,
      nome: d.name,
      aprovar: true,
      motivo: "",
    }));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        processo,
        documentos: documentosBase,
        pendencias: [],
        parecer: "",
        erroIA: "IA não configurada no servidor (ANTHROPIC_API_KEY ausente).",
      };
    }

    const entrada = [
      `Imóvel: ${processo.nome}`,
      processo.tipo ? `Tipo: ${processo.tipo}` : null,
      processo.situacao ? `Situação: ${processo.situacao}` : null,
      processo.objetivo ? `Objetivo: ${processo.objetivo}` : null,
      processo.cidade ? `Local: ${processo.cidade}/${processo.uf ?? ""}` : null,
      "",
      "Documentos enviados:",
      ...(docs ?? []).map(
        (d) => `- id=${d.id} tipo=${d.kind} arquivo="${d.name}" em ${d.created_at.slice(0, 10)}`,
      ),
      (docs ?? []).length === 0 ? "- nenhum" : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const cliente = new Anthropic({ apiKey });
      const resposta = await cliente.messages.parse(
        {
          model: MODELO_IA,
          max_tokens: 2000,
          output_config: {
            ...(aceitaEsforco() ? { effort: "low" as const } : {}),
            format: jsonSchemaOutputFormat(FORMATO_ANALISE),
          },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: entrada }],
        },
        { timeout: 45_000 },
      );

      const saida = resposta.parsed_output;
      if (!saida) throw new Error("resposta fora do formato esperado");

      // A sugestão da IA é casada com os documentos REAIS pelo id. Documento
      // que ela invente não tem par e é descartado; documento que ela esqueça
      // mantém o padrão "aprovar".
      const porId = new Map(saida.documentos.map((d) => [d.id, d]));
      const documentos = documentosBase.map((d) => {
        const s = porId.get(d.id);
        return s ? { ...d, aprovar: s.aprovar, motivo: s.motivo } : d;
      });

      return { processo, documentos, pendencias: saida.pendencias, parecer: saida.parecer };
    } catch (e) {
      console.error("[analise] falha ao chamar a IA:", e);
      avisarErro("sugestão da análise", e);
      return {
        processo,
        documentos: documentosBase,
        pendencias: [],
        parecer: "",
        erroIA: "Não foi possível gerar a sugestão automática. Faça a análise à mão.",
      };
    }
  });

export const publicarAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      documentos: z.array(
        z.object({ id: z.string().uuid(), aprovar: z.boolean(), motivo: z.string() }),
      ),
      pendencias: z.array(z.object({ kind: z.string(), descricao: z.string().min(1) })),
      parecer: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);

    // Status de cada documento. Recusado volta a "Enviado" e ganha pendência
    // pelo bloco seguinte — não existe status "recusado" na tabela, e inventar
    // um agora quebraria as telas que já leem esta coluna.
    for (const d of data.documentos) {
      await supabaseAdmin
        .from("documents")
        .update({ status: d.aprovar ? "Aprovado" : "Enviado" })
        .eq("id", d.id)
        .eq("property_id", data.propertyId);
    }

    if (data.pendencias.length > 0) {
      await supabaseAdmin.from("pendencies").insert(
        data.pendencias.map((p) => ({
          property_id: data.propertyId,
          descricao: p.descricao,
          kind: p.kind,
          criada_por: context.userId,
        })),
      );
    }

    if (data.parecer.trim()) {
      await supabaseAdmin.from("process_notes").upsert(
        {
          property_id: data.propertyId,
          conteudo: data.parecer,
          autor_id: context.userId,
        },
        { onConflict: "property_id" },
      );
    }

    // O estado da coleta é recalculado pelos gatilhos das duas tabelas acima.
    return { ok: true as const };
  });
