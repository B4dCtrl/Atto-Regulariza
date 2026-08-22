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

  // Sem sessão, lançamos aqui em vez de mandar a chamada sem cabeçalho.
  //
  // Devolver `{}` fazia o servidor responder "No authorization header
  // provided" — texto que não diz nada a quem está na tela e manda procurar o
  // problema no lugar errado. A causa real costuma ser mundana: o projeto
  // desloga por inatividade após 10 minutos, e um formulário longo preenchido
  // devagar cabe nesse tempo.
  if (!session?.access_token) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  return { Authorization: `Bearer ${session.access_token}` };
}
