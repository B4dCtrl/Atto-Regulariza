import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exigirAdmin } from "@/lib/api/exigir-admin.server";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { contarNaoLidos } from "@/lib/api/mail-imap.server";
import { DIAS_PARADO, diasDesde } from "@/lib/api/resumo-gerencial";
import {
  caixaDoAdmin,
  montarSaudacao,
  primeiroNome,
  type ProcessoPessoal,
} from "@/lib/api/resumo-pessoal";
import { ROTULO, type Endereco } from "@/lib/mail/enderecos";

/**
 * "O que é seu": o resumo pessoal de cada admin.
 *
 * Separada de `gerarBriefing` de propósito: o navegador faz as duas chamadas
 * em paralelo, e uma caixa de e-mail lenta atrasa só este cartão, nunca o
 * resumo da operação.
 *
 * Quem é "você" sai SEMPRE de `context.userId` (o token validado no
 * servidor); a função não aceita id nem e-mail do navegador. Assim ninguém
 * pede o resumo de outra pessoa trocando um parâmetro.
 */

export type ResumoPessoal = {
  saudacao: string;
  /** Nulo = a caixa não respondeu; a tela mostra "indisponível". */
  naoLidos: number | null;
  /** Rótulo da caixa contada ("Taís"); nulo quando é a caixa inteira. */
  caixa: string | null;
  processos: ProcessoPessoal[];
};

/** Prazo para a Hostinger responder. Passou disso, o cartão sai sem e-mail. */
const PRAZO_IMAP_MS = 10_000;
/** Avisa no sino no máximo uma vez neste intervalo — o painel abre toda hora. */
const INTERVALO_AVISO_MS = 60 * 60_000;
let ultimoAviso = 0;

/**
 * Última contagem de cada admin, por 60 s, na memória da instância.
 *
 * Cada abertura do painel abriria uma conexão IMAP nova (1–2 s); voltar ao
 * /admin logo depois de ler um e-mail repetiria isso à toa. Só guarda
 * contagem que deu certo — falha é tentada de novo na próxima abertura.
 */
const VALIDADE_CONTAGEM_MS = 60_000;
const contagens = new Map<string, { valor: number; ate: number }>();

async function naoLidosOuNulo(userId: string, alias: Endereco | undefined): Promise<number | null> {
  const guardada = contagens.get(userId);
  if (guardada && guardada.ate > Date.now()) return guardada.valor;

  let prazo: ReturnType<typeof setTimeout> | undefined;
  try {
    const valor = await Promise.race([
      contarNaoLidos(alias),
      new Promise<never>((_, rejeitar) => {
        prazo = setTimeout(() => rejeitar(new Error("IMAP demorou demais")), PRAZO_IMAP_MS);
      }),
    ]);
    contagens.set(userId, { valor, ate: Date.now() + VALIDADE_CONTAGEM_MS });
    return valor;
  } catch (e) {
    // Sem credencial ou com a Hostinger fora do ar, o cartão sai sem o
    // número — nunca quebra a página. O aviso vai ao sino, mas espaçado: com
    // quatro admins abrindo o painel, uma queda viraria dezenas de alertas.
    console.error("[resumo pessoal] caixa indisponível:", (e as Error).message);
    if (Date.now() - ultimoAviso > INTERVALO_AVISO_MS) {
      ultimoAviso = Date.now();
      // Sem await: o aviso é telemetria e não pode atrasar o cartão.
      void avisarErro("resumo pessoal: contar e-mails não lidos", e);
    }
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

export const resumoPessoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Nada vem do navegador: a entrada é vazia de propósito.
  .inputValidator(z.object({}).strict().optional())
  .handler(async ({ context }): Promise<ResumoPessoal> => {
    await exigirAdmin(context.userId);
    const agora = new Date();

    // O e-mail do registro de autenticação, não do perfil: o perfil é
    // editável pelo próprio usuário, o `auth.users` não. Alias (tais@,
    // gabriel@…) conta só o que chegou para ele; o dono conta a caixa inteira;
    // qualquer outro e-mail não conta — regra e testes em `caixaDoAdmin`.
    //
    // A contagem IMAP (a parte lenta) começa assim que o e-mail chega, em
    // paralelo com as consultas ao banco abaixo.
    const caixaP = supabaseAdmin.auth.admin
      .getUserById(context.userId)
      .then(({ data: u }) => caixaDoAdmin(u.user?.email))
      .catch(() => null);
    const naoLidosP = caixaP.then((caixa) =>
      caixa ? naoLidosOuNulo(context.userId, caixa === "inteira" ? undefined : caixa) : null,
    );

    const [caixa, naoLidos, perfil, props] = await Promise.all([
      caixaP,
      naoLidosP,
      supabaseAdmin.from("profiles").select("name").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("properties")
        .select("id, name, current_stage, updated_at")
        .eq("assigned_professional_id", context.userId)
        .neq("status", "entregue")
        .order("updated_at", { ascending: true }),
    ]);
    const alias = caixa && caixa !== "inteira" ? caixa : undefined;

    const processos: ProcessoPessoal[] = (props.data ?? []).map((p) => {
      const dias = diasDesde(p.updated_at, agora) ?? 0;
      return {
        id: p.id,
        nome: p.name,
        etapa: p.current_stage ?? 1,
        diasParado: dias,
        parado: dias >= DIAS_PARADO,
      };
    });

    const rotulo = alias ? ROTULO[alias] : null;
    return {
      saudacao: montarSaudacao({
        agora,
        nome: primeiroNome(perfil.data?.name ?? null, rotulo),
        naoLidos,
        processos,
      }),
      naoLidos,
      caixa: rotulo,
      processos,
    };
  });
