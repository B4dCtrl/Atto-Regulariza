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

### 3. ⬜ Trava de visibilidade na interface
Provar que o cliente NÃO vê peça técnica do profissional enquanto o processo corre.
Provado no banco (14 casos automatizados); falta a interface.
**Como testar:** profissional `ozanchet+teste96@gmail.com` envia documento no processo
"Gabriel Zanchet — escritura_velha" → entrar como `ozanchet+teste95@gmail.com` (cliente) e
confirmar que o arquivo não aparece.

### 4. ⬜ Profissional abrindo documento do cliente
Testar com o par correto: `ozanchet+teste96@gmail.com` no processo "Gabriel Zanchet —
escritura_velha", onde existe `proposta-kleber.pdf` com 1 versão.
*(A tentativa anterior usou um processo sem profissional designado — nada apareceria mesmo.)*

### 5. ⬜ Redefinição de senha ponta a ponta
Rota `/redefinir-senha` criada e URLs configuradas no Supabase. Falta o teste completo:
pedir link, clicar, definir senha nova, entrar com ela.
**Pendente também:** acrescentar `https://www.atoregulariza.com.br/**` e
`https://atoregulariza.com.br/**` às Redirect URLs — a Site URL é `.com.br` e esses dois
não estão na lista.

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

### 9. ⬜ Realtime do painel do profissional para documentos
Ao integrar os componentes novos, o listener de `documents` foi removido. A lista dele não
atualiza sozinha quando o cliente envia algo — só ao recarregar ou trocar de processo.

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
