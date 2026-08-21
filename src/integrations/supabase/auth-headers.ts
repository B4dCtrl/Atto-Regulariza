import { supabase } from "@/integrations/supabase/client";

/**
 * Cabeçalho de autenticação para chamar server function.
 *
 * O middleware `requireSupabaseAuth` exige `Authorization: Bearer <token>`, e
 * esse token não viaja sozinho: o Supabase guarda a sessão no `localStorage`,
 * não em cookie, então o navegador não anexa nada às requisições. Sem passar o
 * cabeçalho à mão, toda server function responde
 * "Unauthorized: No authorization header provided" — foi o que manteve
 * `createProfessional` e `chatAssistant` inoperantes desde que existem.
 *
 * Uso:
 *   await minhaFuncao({ data: {...}, headers: await cabecalhoAuth() });
 */
export async function cabecalhoAuth(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Sem sessão, devolvemos o objeto vazio em vez de lançar: quem decide o que
  // dizer ao usuário é a tela, e o servidor recusa de qualquer forma.
  if (!session?.access_token) return {};

  return { Authorization: `Bearer ${session.access_token}` };
}
