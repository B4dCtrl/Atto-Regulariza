# Painel gerencial do admin, com IA

**Data:** 2026-08-21
**Substitui:** `ChatbotPanel` (`admin-chat`) na Visão geral do admin

## O problema

A Visão geral do admin mostra quatro números e cinco prazos. Nenhum deles diz **o que
fazer agora**. Ao lado, um chat de IA respondia dúvidas gerais sobre regularização —
conhecimento que o admin já tem, sobre a operação alheia, e que não olhava para os dados
do próprio sistema. Além disso estava quebrado: aponta para o gateway do Lovable, cujo
segredo nunca foi configurado neste projeto.

Ao mesmo tempo, o sistema não sabe **quem sumiu**. Um cliente que se cadastrou e nunca
mais abriu o painel, um profissional que não toca num processo há uma semana: nada disso
aparece em lugar nenhum.

## O que será construído

A Visão geral perde o chat e ganha um painel gerencial em três blocos, alimentado por
uma análise que a IA gera **uma vez por dia** e que fica guardada no banco.

### Briefing do dia
Um parágrafo escrito, citando nomes: *"Dois profissionais aguardam liberação, o mais
antigo há 3 dias. O processo Casa Teste 1 não se move há 12 dias — a cliente Maria Silva
tem 2 documentos pendentes e não acessa o painel há 9 dias."* Ao lado, o horário da
geração e um botão **Atualizar**.

### Fila priorizada
As tarefas ordenadas por urgência, cada uma com uma linha explicando por que está ali.
Clicar leva ao destino correto: aprovação, processo ou lead.

### Alertas
O que está saindo do radar: lead sem resposta, cliente que parou de enviar documento,
profissional inativo com processo na mão.

Os quatro números e os próximos prazos que já existem permanecem inalterados.

## Registro de acesso

Toda entrada num dos três painéis (cliente, profissional, admin) grava uma linha. É esse
dado que permite responder "quem sumiu".

| Tabela / coluna | Para quê |
|---|---|
| `acessos` | Uma linha por entrada: `user_id`, `painel`, `entrou_em`. Histórico completo. |
| `profiles.ultimo_acesso_em` | Atualizada por gatilho a cada inserção em `acessos`. Leitura barata do "sumiu há quanto tempo", sem varrer o histórico. |

A coluna existe **além** da tabela por uma razão de custo: o briefing precisa do último
acesso de dezenas de pessoas de uma vez, e fazer isso sobre o histórico exigiria um
agregado a cada geração.

`ultimo_acesso_em` nulo significa que a pessoa nunca entrou — é assim que o cliente que
se cadastrou e abandonou aparece, sem precisar de coluna separada para o primeiro acesso.

## Privacidade

**Decisão do usuário (2026-08-21):** nome de pessoa pode ir para a IA.

O resumo enviado à NVIDIA leva nomes de pessoas e de processos. **Não leva** CPF,
matrícula, e-mail, telefone nem conteúdo de documento. O e-mail fica fora mesmo não tendo
sido vetado explicitamente: o briefing não precisa dele, e cada campo a menos é um campo
a menos no registro de um terceiro.

Exemplo do que sai:

```
Aprovações pendentes: 2 profissionais aguardando liberação (mais antigo: 3 dias)
Processos parados: #A3F "Casa Teste 1" — etapa 3, sem movimento há 12 dias,
  2 documentos pendentes do cliente Maria Silva (não acessa há 9 dias)
Leads sem resposta: 3, o mais antigo de 5 dias, Curitiba/PR
Profissionais inativos: João Souza — 2 processos, sem acesso há 6 dias
```

## Contra a invenção

A IA escreve o texto, mas **não é fonte de número**. Todo dado citado é calculado no
servidor antes da chamada e exibido na tela ao lado do texto. Se o briefing disser "12
dias" e a lista mostrar outro valor, a discrepância fica visível na mesma tela. O modelo
recebe instrução explícita de não estimar nem completar o que não estiver no resumo.

## Autorização

- A server function exige admin, verificado em `user_roles` pelo `supabaseAdmin` — nunca
  por papel vindo do cliente.
- `acessos` e `briefings_admin` são legíveis só por admin (RLS).
- Cada pessoa só consegue registrar o **próprio** acesso: a política de INSERT exige
  `user_id = auth.uid()`.
- A chave da NVIDIA só existe no servidor, como já acontece em `assistant.functions.ts`.

## Onde a IA roda

Server function do TanStack, na Vercel — o mesmo caminho do `chatAssistant`. A
`NVIDIA_API_KEY` já está configurada lá e o padrão já existe no projeto. A alternativa
(edge function do Supabase) exigiria uma segunda cópia da mesma chave em outro lugar,
para manter sincronizada.

## Cache

`briefings_admin` guarda uma linha por dia. A geração ocorre na primeira abertura do dia;
as seguintes leem o cache e abrem instantaneamente. O botão **Atualizar** força uma nova
geração e substitui a linha do dia.

Uma chamada por dia, com o `gpt-oss-120b` já em uso: menos de R$ 1 por mês.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260822_painel_gerencial.sql` | `acessos`, `briefings_admin`, `profiles.ultimo_acesso_em`, RLS e gatilho |
| `src/lib/api/briefing.functions.ts` | Server function: reúne os dados, chama a IA, grava o cache |
| `src/lib/api/acessos.ts` | Registrar acesso e listar quem sumiu |
| `src/components/admin/PainelGerencial.tsx` | Os três blocos na tela |
| `src/routes/admin/index.tsx` | **modificar**: troca `ChatbotPanel` por `PainelGerencial` |

**Removidos:** `src/components/admin/ChatbotPanel.tsx` e `supabase/functions/admin-chat/`
(resquício do Lovable, sem chave, apontando para outro fornecedor — fecha o item 15 do
log de ações).

## Erro

O painel nunca fica em branco por causa da IA. Se a chamada falhar, os três blocos
mostram os dados crus — a fila sem a explicação, os alertas sem o texto — e um aviso
discreto de que a análise não pôde ser gerada. Os números vêm do banco e não dependem do
modelo.

Falha ao registrar acesso é silenciosa: o registro é telemetria, e não pode impedir
alguém de usar o painel.

## Testes

- **Vitest** — a montagem do resumo enviado à IA: funções puras que recebem os dados do
  banco e devolvem o texto. Verificam que CPF, matrícula, e-mail e telefone não aparecem
  na saída, e que os cálculos de "há N dias" batem.
- **SQL em `BEGIN … ROLLBACK`** — as políticas: cliente não lê `acessos` alheio,
  profissional não lê `briefings_admin`, ninguém registra acesso em nome de outro.

## Fora de escopo

**Visitante anônimo** — quantas pessoas abriram o site, de onde vieram, que páginas
viram. Exige instalar medição, abrir a CSP para o domínio dela e resolver consentimento
de cookie, numa plataforma que trata CPF e matrícula. É um projeto próprio, adiado até
haver tráfego que justifique.

**Pergunta livre sobre os dados** — o usuário descartou ao escolher os três formatos de
saída. Se voltar, aproveita a mesma montagem de resumo.
