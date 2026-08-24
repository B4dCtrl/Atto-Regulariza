# Log de ações — Ato Regulariza

Lista viva do que precisa ser resolvido, em ordem de prioridade. Um item por vez.
Atualizado conforme avançamos.

**Legenda:** ⬜ a fazer · 🔵 em andamento · ✅ concluído · ⏸️ aguardando decisão

---

## Em andamento

### 16. 🔵 Verificar no ar depois do deploy de 2026-08-21
Tudo abaixo está no código e publicado, mas não foi visto funcionando:
- **Arraste do Kanban** — um `Link` absoluto cobria o cartão e cancelava o gesto; agora o
  mesmo elemento arrasta e abre. *(Não consegui testar: `/admin` local exige sessão.)*
- **Fila do painel gerencial** — clicar deslogava (era `<a>`, que recarrega e faz o
  `beforeLoad` rodar no servidor sem sessão). Agora é `<Link>`.
- **Tarefa do cliente com envio embutido** — pendência com `kind` vira tarefa na caixa
  "O que falta de você".
- **Botão Restaurar** em documento excluído.
- **`createProfessional`** pelo painel admin (o cadastro público já foi testado e funciona).
- **Divergência a observar:** o rodapé do painel dizia "0 lead(s) sem resposta" enquanto o
  briefing citava um lead parado há 5 dias. Pode ser o texto em cache; se repetir com
  números frescos, é invenção da IA e o prompt precisa apertar.

### 1. 🔵 Reputação de envio — e-mails caindo em spam
SMTP próprio configurado e funcionando (Resend, domínio verificado), mas os e-mails caem em
spam. Causa: o domínio começou a enviar hoje, reputação zero, e o modelo padrão do Supabase em
inglês é reconhecido por semelhança com spam conhecido.
**Feito:** SPF, DKIM e DMARC no DNS · SMTP no Supabase · modelos em português com a marca
**Falta:** aplicar os modelos no painel · marcar "não é spam" · esperar a reputação firmar
**Conferir:** SPF/DKIM/DMARC em "Mostrar original" de um e-mail recebido

### 2. ✅ Reset das contas de teste — CONCLUÍDO
Base zerada em 2026-08-15. Apagados: 20 usuários, 11 processos, 9 documentos, 16 leads, 28
mensagens, 55 etapas e os arquivos do bucket. Preservada só a conta admin
(`ozanchet@gmail.com`), com o papel de admin intacto.

---

## Verificação pendente do trabalho de hoje

> **Base zerada.** Só a conta admin permanece. Os testes abaixo precisam de contas novas: um
> cliente, um profissional aprovado, e um processo ligando os dois.

### 3. ✅ Trava de visibilidade — CONFIRMADA NA INTERFACE
O que o profissional envia não aparece para o cliente. Provado no banco (17 casos) e na tela.

### 4. ✅ Profissional abrindo documento do cliente — FUNCIONA

### 5. ✅ Redefinição de senha — FUNCIONA
Rota `/redefinir-senha`, SMTP próprio e Redirect URLs configuradas.

### 5b. ✅ Painel do profissional sem `localStorage` — CONFIRMADO
Os cinco conjuntos gravam no banco e sobrevivem ao recarregamento: campos das etapas, estado
das etapas, pendências, anotações internas e leitura do chat.

---

## Antes de ir a produção

### 6. ✅ E-mail do admin para arquivos acima de 25 MB — CONCLUÍDO
A mensagem agora traz `contato@atoregulariza.com.br`, caixa criada na Hostinger em
2026-08-19. A edge function `upload-documento` foi republicada, então já vale em produção.

### 7. ✅ Religar a confirmação de e-mail — CONCLUÍDO
Religada em 2026-08-21 (Authentication › Sign In / Providers › Email › Confirm email).
Nenhuma conta ficou bloqueada: as três existentes já estavam confirmadas.
*Falta ainda o item 1 — sem os modelos aplicados, o e-mail de confirmação sai em inglês.*

### 8. ✅ Merge da branch `feat/seguranca-e-documentos` na `main` — CONCLUÍDO
77 commits, merge `78dbccd` em 2026-08-21. Branch mantida (não apagada).
**Falta conferir em produção:** tarefa do cliente com envio embutido · botão Restaurar em
documento excluído · animação do "Entrar" na hero.

---

## Dívidas conhecidas, sem urgência

### 9. ✅ Realtime de documentos — CONCLUÍDO
Três assinaturas acrescentadas (caso aberto, aba Documentos, painel do cliente). O canal só
avisa; quem busca é o DocumentList, cuja consulta passa pela RLS.

### 10. ✅ Campo de texto "Pendências" duplicando o botão "+ Pendência" — REMOVIDO
O campo de texto livre da etapa 1 saiu. Restou só o botão "+ Pendência", que cria pendência
de verdade e chega ao cliente.

### 10b. ✅ Dois pontos de envio na tela do profissional — "Arquivos desta etapa" REMOVIDO
O bloco do painel central saiu; o envio ficou só na aba Documentos. O rótulo "desta etapa"
prometia algo que o modelo de dados não entrega: não existe coluna ligando documento a etapa.

### 13. ✅ Divergência de hidratação (React #418) — RESOLVIDO
Causa: `custom-cursor` devolvia `null` no servidor (`typeof window === "undefined"`) e o cursor
já na PRIMEIRA renderização do cliente. As duas árvores não batiam, e hidratação que falha não
degrada só o componente — o React descarta o HTML do servidor. Em produção ele se recuperava
refazendo tudo; em desenvolvimento abortava, deixando a página sem manipulador de evento
nenhum.
Corrigido em 2026-08-21 com estado `montado` ligado por `useEffect`.
**Atenção ao verificar:** o servidor de dev guarda o módulo de SSR em cache. Depois de mexer
em algo que renderiza no servidor, **reinicie o servidor** — sem isso o erro persiste e leva a
descartar o culpado certo, que foi o que aconteceu aqui na primeira tentativa.
**Confirmado:** console limpo em `/entrar` e `/cadastrar`, e os cliques voltaram a responder.

### 17. 🔵 Briefing da IA esgotando o tempo
A chamada ao NVIDIA NIM não respondeu em 25s. Prazo subiu para 50s (limite da Vercel é 60s),
pedido caiu de 900 para 700 tokens, e a duração passou a ser registrada.
**Como diagnosticar:** Vercel › Logs, procurar `[briefing]`. Vai dizer `IA respondeu em Nms`
ou `falha ao chamar a IA após Nms`.
**Hipótese não descartada:** o modelo `openai/gpt-oss-120b` pode não existir mais no catálogo
da NVIDIA — esse nome veio do `chatAssistant`, que nunca havia sido testado em produção.

### 18. ⬜ Visitante anônimo (subprojeto adiado)
Quantas pessoas abrem o site, de onde vêm, que páginas veem. Exige instalar medição, abrir a
CSP para o domínio dela e resolver consentimento de cookie numa plataforma que trata CPF e
matrícula. Os "acessos" que o painel mostra hoje são de gente logada, não de visitante.

### 14. ⬜ Assistente de IA duplicado no horizonte
Hoje o site usa NVIDIA NIM (`gpt-oss-120b`) em `assistant.functions.ts`, com o system prompt
e as travas certas. Se o atendimento do WhatsApp nascer separado, serão duas personalidades
respondendo pela mesma empresa. **Decisão do usuário (2026-08-21): deixar separado por ora.**
Quando for unificar: extrair o miolo (contexto + prompt + chamada) e deixar dois adaptadores
finos. Atenção à autorização — no site há sessão; no WhatsApp só o número de telefone.

### 11. ✅ Recuperar documento excluído — CONCLUÍDO
Migração rodada em 2026-08-21; as quatro verificações voltaram OK.
Botão "Restaurar" na lista, para admin e profissional atribuído. Corrige de quebra uma
incoerência: a política `documents_select` filtrava `deleted_at IS NULL` antes de chamar
`can_read_document`, anulando a regra que a migração `20260808b` tinha escrito para a equipe
ver o próprio histórico — o ramo de `DocumentList` que trata `deleted_at` era inalcançável.
**Migração:** `supabase/migrations/20260821_restaurar_documento.sql`.
*Falta conferir na tela: excluir um documento e restaurá-lo.*

### 12. ✅ Server functions — CONCLUÍDO
Nunca funcionaram: faltava o cabeçalho `Authorization` nas chamadas. Confirmado em produção
em 2026-08-22, com o cadastro pelo painel admin funcionando de ponta a ponta.
*(Texto antigo abaixo, mantido pelo diagnóstico.)*
### 12b. Diagnóstico original
Nunca funcionaram, e não era variável de ambiente: as três chamadas passavam só `data`, sem
`Authorization`. O token do Supabase mora no `localStorage`, não em cookie, então o navegador
não anexa nada — o middleware recusava com "No authorization header provided".
Corrigido em 2026-08-21 com `cabecalhoAuth()` em `src/integrations/supabase/auth-headers.ts`.
As variáveis de ambiente **estão** na Vercel: o erro vinha da checagem de cabeçalho, que roda
depois da checagem de ambiente.
**Retestar:** cadastrar profissional pelo painel admin · pedir resposta à IA num processo.

### 15. ✅ `admin-chat` removido — CONCLUÍDO
O painel gerencial tomou o lugar dele na Visão geral. A edge function foi apagada do
projeto Supabase e do código, junto com o `ChatbotPanel` e a entrada no `config.toml`.
Fim do resquício do Lovable: sobra um único fornecedor de IA (NVIDIA NIM), em
`assistant.functions.ts` e `briefing.functions.ts`.


---

## Concluído hoje (2026-08-07 / 08-15)

- ✅ Auditoria de segurança: 5 vulnerabilidades corrigidas
- ✅ `admin-chat` fechada (estava sem `verify_jwt`, CORS `*`, sem checagem de papel)
- ✅ Escalação de privilégio: papel imutável, fila de aprovação de profissional
- ✅ `LOGIN_PAUSED` removido das rotas admin (desligava a autenticação do back office)
- ✅ Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options) no `vercel.json`
- ✅ `leads` com limite de formato, tamanho e frequência
- ✅ `.env` fora do versionamento
- ✅ Armazenamento real de documentos, com versionamento e checksum
- ✅ Trava de visibilidade provada no banco (14 casos)
- ✅ Preview e download por URL assinada de 5 minutos
- ✅ Redefinição de senha (nunca existiu no site)
- ✅ Realtime do painel do cliente religado (dependências `[]` o mantinham morto)
- ✅ Variáveis de ambiente da Vercel corrigidas (`VITE_SUPABASE_UR` sem o `L`)
- ✅ Lista de origens CORS corrigida (tinha só `.com.br`; o site é servido do `.com`)
- ✅ SMTP próprio com Resend; `atoregulariza.com.br` verificado (SPF, DKIM, DMARC)
- ✅ Quatro modelos de e-mail em português com a identidade da Ato
- ✅ Versionamento por tipo na edge function (o spec previa, nunca foi implementado)
- ✅ Aba lateral "Documentos" no painel do profissional
- ✅ Reset da base de teste, preservando a conta admin
- ✅ Trava de visibilidade confirmada NA INTERFACE: o que o profissional envia não aparece
  para o cliente
- ✅ Pull Request aberto: https://github.com/B4dCtrl/Atto-Regulariza/pull/1
- ✅ Frente 2, plano 1: 5 tabelas, RLS e gatilhos; 17 casos de autorização; camada de API
- ✅ Frente 2, plano 3: pendência vira tarefa com envio embutido na caixa "O que falta de
  você"; sino de notificações; pedido de aprovação de conclusão no painel do profissional
  *(falta conferir na tela com um cliente de teste)*
- ✅ Frente 2, plano 2: painel do profissional sem `localStorage`, confirmado no navegador;
  conferência sobre os documentos reais; dispensar vistoria; responsável técnico automático;
  aviso flutuante de salvamento

## Concluído em 2026-08-21

- ✅ Caixa `contato@atoregulariza.com.br` na Hostinger; MX e SPF na raiz, sem duplicar o SPF
  do Resend (que vive em `send.`)
- ✅ Item 6: e-mail real na mensagem de arquivo acima de 25 MB, edge function republicada
- ✅ Item 7: confirmação de e-mail religada
- ✅ Sino de notificações: painel abria fora da tela e era recortado pelo `overflow-hidden`
  da barra lateral; agora é renderizado no `body` por portal
- ✅ Urgência/prioridade removida de sete arquivos — sugeria que o processo poderia correr
  mais rápido, o que prefeitura e cartório não permitem. Colunas do banco preservadas
- ✅ Seletor de cidade por estado, com busca: 5.571 municípios em 27 arquivos, carregados
  sob demanda (6 KB no PR, 12,9 KB em MG)
- ✅ "Nome do projeto" fora do cadastro do cliente
- ✅ CTA da Hero (e dos outros três que compartilham o link) para (41) 98447-1404
- ✅ Cartão da barra lateral do cliente conta pendências reais, não `next_action`

## Concluído em 2026-08-24

- ✅ Protocolo de coleta de documentos: checklist inicial pós-tutorial, análise com IA triando
  e pessoa confirmando, e trava de delegação nos documentos essenciais
  *(faltam as duas migrações e a verificação na tela)*
- ✅ Item 11: restaurar documento excluído, e a política `documents_select` corrigida
- ✅ Item 13: divergência de hidratação — era o `custom-cursor`
- ✅ Botão "Entrar" na hero antes do scroll, viajando até o menu pelo mesmo `layoutId` do logo
- ✅ Item 12: `createProfessional` e `chatAssistant` nunca funcionaram — faltava o cabeçalho
  `Authorization` nas chamadas
- ✅ StaffBar enxugada (4 destinos inúteis) e 308 linhas de código morto de `/gestao`
- ✅ Painel gerencial do admin: briefing diário, fila priorizada e alertas, com registro
  de acesso aos três painéis
