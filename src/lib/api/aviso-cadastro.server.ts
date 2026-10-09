/**
 * Recebe do banco o aviso de "cliente terminou o cadastro" e o leva ao
 * WhatsApp da equipe.
 *
 * Quem chama é o gatilho de `properties` (migração 20261009_aviso_cadastro),
 * pelo pg_net, com o segredo `AVISO_CADASTRO_SEGREDO` no cabeçalho. O corpo
 * traz só o id: o resto é lido do banco aqui, com a chave de serviço. Assim,
 * mesmo quem descobrir o segredo não escolhe o texto da mensagem — só pode
 * reapontar um processo que acabou de nascer, que é justamente o aviso certo.
 *
 * Responde 200 em qualquer erro depois da autenticação: o pg_net não tenta de
 * novo, e o que falhar vira alerta no sino do admin.
 */

import process from "node:process";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { avisarNovoCadastro } from "@/lib/api/avisar-lead.server";
import { cadastroRecente, valoresDoAviso } from "@/lib/aviso-cadastro";

/** Comparação em tempo constante: não vaza o segredo pela demora da resposta. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function receberAvisoDeCadastro(request: Request): Promise<Response> {
  const segredo = process.env.AVISO_CADASTRO_SEGREDO;
  const recebido = request.headers.get("x-aviso-segredo") ?? "";
  if (!segredo || !iguais(segredo, recebido)) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const corpo = (await request.json().catch(() => null)) as { id?: unknown } | null;
    const id = typeof corpo?.id === "string" && UUID.test(corpo.id) ? corpo.id : null;
    if (!id) return new Response("bad request", { status: 400 });

    const { data: p, error } = await supabaseAdmin
      .from("properties")
      .select(
        "client_name, client_email, client_phone, tipo_imovel, situacao, objetivo, city, state, created_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      await avisarErro("aviso de novo cadastro", error.message);
      return new Response("ok");
    }
    if (!p || !cadastroRecente(p.created_at)) return new Response("ok");

    await avisarNovoCadastro(valoresDoAviso(p));
    return new Response("ok");
  } catch (e) {
    console.error("[aviso-cadastro] falha", e);
    await avisarErro("aviso de novo cadastro", e);
    return new Response("ok");
  }
}
