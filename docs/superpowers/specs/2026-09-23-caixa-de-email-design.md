# Caixa de e-mail no painel (`/mail`)

**Data:** 2026-09-23

## O problema

O e-mail da empresa vive só na Hostinger. Para ler ou responder, é preciso sair do painel e
abrir o webmail, e não há como saber quem da equipe já respondeu o quê. A empresa paga uma
única caixa, `contato@atoregulariza.com.br`, e quer que os três profissionais também tenham
endereço próprio sem pagar caixas novas.

## Decisões tomadas

**Ler direto da Hostinger por IMAP, sem copiar e-mail para o banco** (decisão do usuário,
2026-09-23). A alternativa — encaminhar para o Resend e guardar no Supabase — leva de duas a
três vezes mais tempo e duplica dado pessoal. Se um dia fizer falta ligar e-mail a cliente, ela
entra por cima desta sem refazer a tela.

**Uma caixa, quatro aliases.** `gabriel@`, `tais@`, `lauro@` e `suporte@` são aliases da
Hostinger (criados em 2026-09-23; o plano permite 5) que entregam em `contato@`. A Hostinger
permite enviar e receber por eles. O painel mostra para qual endereço cada e-mail foi mandado.
`suporte@` é o endereço público que vai para o rodapé do site.

**Ler, responder e escrever e-mail novo** já nesta versão (decisão do usuário, 2026-09-23).

**Os três profissionais recebem papel `admin` completo** (decisão do usuário, 2026-09-23). Um
papel `equipe` mais restrito fica para depois. O papel é dado na tabela `user_roles`, nunca
deduzido do endereço de e-mail: se qualquer `@atoregulariza.com.br` virasse admin sozinho, criar
um alias novo daria acesso a tudo.

**Nada público.** Toda leitura e todo envio passam por server function que confere o papel no
banco a cada chamada. Esconder o link não conta como proteção.

## Arquitetura

```
navegador (/admin/mail)
   │  server functions, com o JWT do usuário
   ▼
mail.functions.ts ── exigirAdmin(userId) ── user_roles
   │
   ├── mail-imap.server.ts ── imap.hostinger.com:993 (TLS)  ler, marcar lido, gravar em Enviados
   └── mail-smtp.server.ts ── smtp.hostinger.com:465 (TLS)  enviar
```

Uma conexão por chamada: serverless não guarda conexão aberta entre requisições. Abrir a caixa
leva de 1 a 2 segundos, aceito na decisão.

### Rotas

- `/admin/mail` — a tela, dentro do layout do admin, que já barra quem não é admin em
  `beforeLoad`.
- `/mail` — só redireciona para `/admin/mail`. É o endereço curto que o usuário pediu.
- `robots.txt` ganha `Disallow: /mail`.

A barreira de verdade é a server function. O `beforeLoad` só evita mostrar a tela vazia.

### Server functions (`src/lib/api/mail.functions.ts`)

Todas com `requireSupabaseAuth`, entrada validada com Zod e `exigirAdmin` como primeira linha.

| Função | Entrada | Faz |
|---|---|---|
| `listarEmails` | pasta (`entrada` \| `enviados`), página, filtro de alias opcional | 50 por página, mais novos primeiro: remetente, destinatário, assunto, data, lido, tem anexo |
| `abrirEmail` | pasta, uid | Corpo já limpo, anexos (nome, tipo, tamanho), cabeçalhos da conversa. Marca como lido |
| `baixarAnexo` | pasta, uid, índice do anexo | O arquivo, com `Content-Disposition: attachment` |
| `enviarEmail` | de (alias), para, assunto, texto, e opcionalmente o uid respondido | Envia por SMTP, grava cópia em Enviados, registra quem enviou |

As pastas são uma lista fechada no servidor. O cliente nunca manda nome de pasta IMAP.

### Remetente

`de` só aceita um de cinco endereços: `contato@`, `suporte@`, `gabriel@`, `tais@`, `lauro@`.
Na resposta, o padrão é o alias que recebeu o e-mail, descoberto pelos cabeçalhos `To`, `Cc` e
`Delivered-To`; sem alias reconhecido, `contato@`. A autenticação SMTP é sempre a do
`contato@` — o alias só muda o `From`.

### Conversa

A resposta leva `In-Reply-To` e `References` do e-mail original e o assunto com `Re:`, para o
Gmail e o Outlook de quem recebe agruparem a conversa. O texto original entra citado abaixo.

### Registro de envios

Tabela `mail_envios`: `id`, `user_id`, `de`, `para`, `assunto`, `respondendo_message_id`,
`enviado_em`. RLS ligada; só `admin` lê; ninguém insere pelo cliente — só a server function,
com `service_role`. Serve para a equipe ver quem respondeu e para o limite de envio.

**Limite:** 30 envios por hora por usuário, contados nessa tabela antes de enviar.

## Segurança

- **Senha da caixa** em `MAIL_USER` e `MAIL_PASSWORD`, variáveis da Vercel lidas só em
  `*.server.ts`. Nunca vão ao navegador, nunca aparecem em log.
- **HTML de e-mail é conteúdo de estranho.** Limpo no servidor com DOMPurify (sem `script`,
  `iframe`, `form`, `on*`, `javascript:`) e mostrado num `<iframe sandbox srcdoc>` sem
  `allow-scripts` nem `allow-same-origin`. Nenhum `dangerouslySetInnerHTML`.
- **Imagens externas não carregam.** Elas servem de pixel de rastreio, e a CSP do site já as
  bloqueia (`img-src` não inclui domínios de terceiros; o `srcdoc` herda a CSP). Imagens
  embutidas no próprio e-mail (`cid:`) viram `data:` e aparecem. Um botão "mostrar imagens"
  exigiria um proxy e fica fora desta versão.
- **Links** abrem em nova aba com `rel="noopener noreferrer"`.
- **Anexo baixado nunca é aberto no navegador**: sempre download, nunca `inline`.
- **Entrada do envio** validada com Zod: `para` como e-mail válido (até 10 destinatários),
  assunto até 200 caracteres, texto até 20 mil. Sem cabeçalho montado a partir de texto do
  usuário, o que evita injeção de cabeçalho.
- **Erro para o cliente** é genérico ("não foi possível abrir a caixa"). O detalhe vai para
  `avisarErro`, que já leva ao sino do admin.

## Tela

Três áreas: lista à esquerda (com abas Entrada e Enviados e o filtro "Todos / Contato / Suporte /
Gabriel / Taís / Lauro"), e-mail aberto à direita, e o botão **Escrever** no topo. Responder abre o
editor embaixo do e-mail, com `de` e `para` já preenchidos. No celular, a lista e o e-mail
viram telas separadas.

O editor é texto simples. Formatação e anexo no envio ficam fora desta versão.

## Fora desta versão

Anexo no envio, busca, pastas além de Entrada e Enviados, apagar e mover e-mail, "mostrar
imagens", papel `equipe`, ligar e-mail ao cliente.

## Caixa por pessoa (2026-09-25)

Depois da versão acima, o filtro "Todos / Contato / Suporte / Gabriel / Taís / Lauro" virou
**visões**: `todos` (a caixa inteira), `geral` (o que não foi mandado a nenhum alias pessoal —
só `contato@`/`suporte@`) e uma por pessoa (o alias dela **mais** o que qualquer admin atribuiu
a ela). A regra fica em `src/lib/mail/visoes.ts` (`visoesDaMensagem`, referência) e a busca IMAP
que a implementa (`buscaDaVisao`), com teste de equivalência entre as duas.

- **"Atribuir a…"**: qualquer admin passa um e-mail (entrada ou enviados) para o Gabriel, a Taís
  ou o Lauro. Ele entra na caixa da pessoa com a etiqueta "com Taís", sem sair de onde já
  estava — um e-mail do Geral atribuído à Taís aparece nos dois. A tabela
  `public.mail_atribuicoes` guarda só o par Message-ID → pessoa; a chave é o Message-ID (lido no
  servidor, nunca do navegador) e não o UID do IMAP, porque UID muda se a mensagem trocar de
  pasta.
- Atribuir também vale em **Enviados**: a visão da pessoa lá é "From o alias dela **ou**
  atribuído a ela" — não só o From literal do design original.
- **"O que é seu"** (cartão do painel) conta a mesma visão da caixa que a pessoa abre. Como a
  contagem de não lidos é cacheada, uma atribuição nova pode levar até **~60 s** para aparecer
  ali (a caixa de e-mail em si é sempre ao vivo).
- **Limite da busca por atribuições**: cada atribuição vira um termo `HEADER Message-ID <...>`
  dentro de um `OR` — a busca inteira sai numa linha só, e o Dovecot da Hostinger recusa linha
  acima de 64 KB. Entram as até `LIMITE_ATRIBUIDOS_NA_BUSCA` (200) mais recentes, cortadas ainda
  por `LIMITE_BYTES_ATRIBUIDOS_NA_BUSCA` (40 KB somados) — o que vier primeiro. As atribuições
  que ficam de fora continuam visíveis em "Todos", com a etiqueta.
- **Busca do IMAP é por substring** (`TO`/`CC`/`FROM`/`HEADER` "contém", não "igual"). Um
  endereço externo tipo `xtais@atoregulariza.com.br` casaria com o alias `tais@…`, mas o domínio
  é nosso, então não acontece na prática; Message-IDs vêm entre `< >`, o que já torna a busca
  por eles efetivamente exata.

## Rodapé do site

Depois da caixa pronta, o rodapé público passa a mostrar `suporte@atoregulariza.com.br` como
contato por e-mail (pedido do usuário, 2026-09-23).

## Testes

- Limpeza de HTML: remove `script`, `on*`, `javascript:`, `iframe`; mantém texto, links e
  tabelas; troca `cid:` por `data:`.
- Descoberta do alias que recebeu, por `To`, `Cc` e `Delivered-To`, com maiúsculas e nome de
  exibição.
- Montagem da resposta: `Re:` sem duplicar, `In-Reply-To`, `References` acumulado, citação.
- Validação: remetente fora da lista é recusado; `para` inválido é recusado.
- Autorização: chamada sem papel `admin` é recusada antes de qualquer conexão IMAP.

## O que o usuário precisa fazer fora do código

1. ~~Criar os aliases no hPanel~~ — feito em 2026-09-23.
2. Colar `MAIL_USER` e `MAIL_PASSWORD` nas variáveis de ambiente da Vercel.
3. Cada profissional cria a conta no site com o seu alias; o admin dá o papel `admin` pela
   `user_roles`.
