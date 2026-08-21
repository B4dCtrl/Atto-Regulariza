# Log de ações — Ato Regulariza

Lista viva do que precisa ser resolvido, em ordem de prioridade. Um item por vez.
Atualizado conforme avançamos.

**Legenda:** ⬜ a fazer · 🔵 em andamento · ✅ concluído · ⏸️ aguardando decisão

---

## Em andamento

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

### 7. ⬜ Religar a confirmação de e-mail
Foi desligada para os testes. Sem ela, qualquer pessoa se cadastra usando o e-mail de
terceiros e passa a receber as notificações do processo alheio.
*(Resolve junto com o item 1.)*

### 8. ⬜ Merge da branch `feat/seguranca-e-documentos` na `main`
30+ commits. Publica o trabalho de segurança e de documentos.
**Não fazer antes** dos itens 3, 4 e 5 estarem verificados.

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

### 13. ⬜ Divergência de hidratação (React #418)
O HTML do servidor não bate com a primeira renderização do cliente. Em produção o React
se recupera refazendo a árvore inteira — o site funciona, mas paga uma renderização a mais
em toda visita. **Em desenvolvimento é pior:** o React aborta a hidratação e a página fica
sem manipulador de evento nenhum, o que impede testar qualquer coisa no navegador local.
**Já descartados:** `ConstructionGate` e `StaffBar` (ambos começam com o mesmo estado nos
dois lados) · `custom-cursor` (corrigido em 2026-08-21, não era a causa única)
**Suspeito restante:** `framer-motion` — o SSR emite `style="opacity:0;transform:translateX(16px)"`
e o cliente pode formatar diferente.
**Como reproduzir:** abrir `/cadastrar` no dev e clicar numa opção; nada acontece.
**Precisa de:** bisecção com tempo dedicado.

### 14. ⬜ Assistente de IA duplicado no horizonte
Hoje o site usa NVIDIA NIM (`gpt-oss-120b`) em `assistant.functions.ts`, com o system prompt
e as travas certas. Se o atendimento do WhatsApp nascer separado, serão duas personalidades
respondendo pela mesma empresa. **Decisão do usuário (2026-08-21): deixar separado por ora.**
Quando for unificar: extrair o miolo (contexto + prompt + chamada) e deixar dois adaptadores
finos. Atenção à autorização — no site há sessão; no WhatsApp só o número de telefone.

### 11. ⬜ Recuperar documento excluído
A exclusão lógica preserva tudo no banco, mas não há tela para desfazer.

### 12. ⬜ Server functions sem variáveis em produção
`SUPABASE_SERVICE_ROLE_KEY` e `NVIDIA_API_KEY` foram criadas na Vercel hoje, mas as funções
`createProfessional` e `chatAssistant` nunca foram testadas em produção.

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
