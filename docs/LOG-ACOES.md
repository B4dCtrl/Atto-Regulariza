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

### 5b. ⬜ Testar o painel do profissional sem `localStorage`
O plano 2 acabou de trocar cinco conjuntos de dados por acesso ao banco. Precisa de teste no
navegador: preencher campo de etapa, concluir etapa, criar pendência, escrever anotação,
conferir documento no checklist — e recarregar a página para ver se tudo persistiu.

---

## Antes de ir a produção

### 6. ⬜ E-mail do admin para arquivos acima de 25 MB
A mensagem de erro mostra o texto literal `[PENDÊNCIA: e-mail do admin]` para o usuário
final. Já está em produção, porque a edge function está publicada.
**Onde:** `supabase/functions/_shared/documento-validacao.ts`

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

### 10. ⬜ Dois pontos de envio na tela do profissional
Há o bloco "Arquivos desta etapa" no painel central e a aba Documentos. O rótulo "desta
etapa" promete algo que o modelo de dados não entrega: não existe coluna ligando documento a
etapa. Recomendação: remover o da etapa.

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
- ✅ Frente 2, plano 2: painel do profissional sem `localStorage`; conferência sobre os
  documentos reais
