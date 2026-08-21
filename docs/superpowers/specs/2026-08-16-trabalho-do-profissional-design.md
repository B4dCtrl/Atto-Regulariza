# Trabalho do profissional no banco — Design

**Data:** 2026-08-16
**Escopo:** Frente 2 de 4 · sucede o [armazenamento de documentos](2026-08-07-armazenamento-documentos-design.md)
**Status:** aprovado pelo usuário, pronto para o plano

---

## Problema

O painel do profissional guarda **todo o trabalho dele no `localStorage` do navegador**:

| Chave | Conteúdo |
|---|---|
| `rz-stage-fields` | Preenchimento técnico das 5 etapas — ART, vistoria, protocolo, área |
| `rz-pendencies` | Pendências que travam o caso |
| `rz-done-stages` | Etapas marcadas como concluídas |
| `rz-private-notes` | Anotações internas por processo |
| `rz-last-chat-view` | Última leitura do chat |

Consequências: limpar o navegador apaga o trabalho; outro computador mostra tudo em branco; o
admin não enxerga nada; o cliente nunca sabe da pendência; profissional que sai da empresa
deixa o caso órfão.

Além disso, a tela mistura sem distinção o que é real (documentos, que vão ao banco) com o que
é ilusório (conferência, pendências, resumo). Visualmente parecem a mesma coisa.

## Objetivo

Levar o trabalho do profissional para o banco, ligar a conferência aos documentos que existem
de verdade, e fazer pendência virar tarefa para o cliente.

Critérios de sucesso:

1. Nada do trabalho do profissional depende do navegador
2. O admin enxerga o que cada profissional registrou
3. Pendência aparece para o cliente como pedido com envio direto
4. A conferência opera sobre documentos reais, não sobre lista fictícia
5. Anotação interna é invisível ao cliente, inclusive por consulta direta
6. Profissional e admin são avisados de mensagem e arquivo novos

## Fora de escopo

- Resumo por e-mail (fica para uma segunda etapa, ver [Notificações](#notificações))
- Caixa "O que falta de você" ativa fora de pendências (frente 4)
- Vínculo entre documento e etapa
- Recuperação de documento excluído

---

## Decisões tomadas com o usuário

| Pergunta | Decisão |
|---|---|
| O que exige aval do admin | Concluir o processo inteiro · Excluir documento |
| Como notificar | Sino no sistema **e** e-mail resumindo — sino primeiro |
| O que o cliente vê da pendência | Tarefa com envio direto na caixa "O que falta de você" |
| Conferência | Passa a operar sobre os documentos reais |

---

## A conferência vira os documentos reais

Hoje a etapa 1 traz uma lista fixa de seis itens (`docs_recebidos`), sem qualquer relação com
os arquivos enviados. Marcar "IPTU atualizado" não significa que o IPTU chegou.

Passa a ser assim: a etapa 1 lista os **tipos de documento** de `document-kinds.ts` com origem
`cliente`, cada um em um de três estados:

| Estado | Aparência | Ação disponível |
|---|---|---|
| **Não enviado** | opaco, "aguardando o cliente" | botão **Solicitar** → cria pendência |
| **Enviado** | clicável, abre o arquivo | caixa marca como **conferido** |
| **Conferido** | caixa marcada, data e quem conferiu | desmarcar volta a "Enviado" |

Não há estrutura nova para isso: a coluna `documents.status` já existe e assume `Enviado`,
`Em análise` e `Aprovado`. Conferir grava `Aprovado`.

Ganho central: um só mundo. O que o profissional confere é o que o cliente mandou.

---

## Modelo de dados

### `process_stages.fields` — preenchimento técnico

Coluna `jsonb` acrescentada à tabela existente. Cada linha de etapa já existe por processo, e
os campos variam por etapa (`STAGE_DEFS`), o que torna coluna estruturada inviável sem uma
tabela por etapa.

```sql
alter table public.process_stages add column fields jsonb not null default '{}'::jsonb;
```

Chaves iguais aos `id` de `FieldDef`: `data_vistoria`, `art_numero`, `num_protocolo`, etc.

### `pendencies` — o que trava o caso

```sql
create table public.pendencies (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  stage_number   int,
  descricao      text not null,
  kind           text,          -- tipo de documento pedido; nulo = pedido genérico
  status         text not null default 'aberta',   -- 'aberta' | 'resolvida'
  criada_por     uuid references auth.users(id) on delete set null,
  criada_em      timestamptz not null default now(),
  resolvida_em   timestamptz,
  resolvida_por  uuid references auth.users(id) on delete set null,
  constraint pendencies_status_ck check (status in ('aberta','resolvida')),
  constraint pendencies_descricao_ck check (length(descricao) between 1 and 2000)
);
```

`kind` é o que transforma a pendência em tarefa acionável: com ele, a caixa do cliente mostra
o botão de envio já com o tipo escolhido. Sem ele, é recado.

**Resolução automática:** gatilho em `document_versions` fecha a pendência aberta do mesmo
`kind` no mesmo processo quando o cliente envia. O profissional não precisa lembrar de dar
baixa, e o cliente vê a tarefa sumir na hora — que é o retorno que faz ele agir.

### `process_notes` — anotação interna

**Tabela separada por necessidade de privacidade, não por organização.** As anotações não
podem ficar em `process_stages` porque aquela tabela é legível pelo cliente, e a RLS filtra
linha, não coluna: o cliente leria o conteúdo por consulta direta mesmo sem vê-lo na tela.

```sql
create table public.process_notes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  conteudo    text not null,
  autor_id    uuid references auth.users(id) on delete set null,
  criada_em   timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
```

RLS: só admin e profissional atribuído, para leitura e escrita. Cliente não tem política
nenhuma.

### `notifications` — o sino

```sql
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  tipo        text not null,   -- 'mensagem' | 'documento' | 'pendencia' | 'aprovacao'
  titulo      text not null,
  corpo       text,
  lida        boolean not null default false,
  criada_em   timestamptz not null default now()
);
```

Criadas por gatilho em `messages`, `document_versions`, `pendencies` e `approval_requests`.

**Quem recebe o quê:**

| Evento | Notifica |
|---|---|
| Cliente envia mensagem | profissional atribuído |
| Cliente envia documento | profissional atribuído |
| Profissional envia mensagem | cliente |
| Profissional cria pendência | cliente |
| Cliente resolve pendência | profissional |
| Pedido de aprovação | todos os admins |
| Admin decide | quem pediu |

Ninguém é notificado da própria ação.

### `approval_requests` — o aval do admin

```sql
create table public.approval_requests (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  tipo          text not null,   -- 'conclusao' | 'exclusao_documento'
  document_id   uuid references public.documents(id) on delete cascade,
  justificativa text,
  status        text not null default 'pendente',  -- 'pendente'|'aprovado'|'recusado'
  solicitado_por uuid references auth.users(id) on delete set null,
  solicitado_em timestamptz not null default now(),
  decidido_por  uuid references auth.users(id) on delete set null,
  decidido_em   timestamptz,
  motivo_recusa text,
  constraint approval_tipo_ck check (tipo in ('conclusao','exclusao_documento')),
  constraint approval_status_ck check (status in ('pendente','aprovado','recusado'))
);
```

**A aprovação é imposta no banco, não na tela.** Um gatilho em `properties` recusa mudança de
`status` para `entregue` sem pedido aprovado; outro em `documents` recusa `deleted_at` vindo de
não-admin sem pedido aprovado. Se ficasse só na interface, bastaria uma chamada direta à API
para contornar.

Admin continua podendo agir direto, sem pedir a si mesmo.

### `chat_reads` — contador de não lidas

```sql
create table public.chat_reads (
  user_id      uuid not null references auth.users(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  lido_ate     timestamptz not null default now(),
  primary key (user_id, property_id)
);
```

RLS: cada um só lê e escreve a própria linha.

---

## Autorização

Seguindo o que já existe, uma função por decisão, usada por RLS e por gatilho:

```sql
-- Equipe do processo: admin ou profissional atribuído
create or replace function public.pode_gerenciar_processo(_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.properties p
    where p.id = _property_id and p.assigned_professional_id = auth.uid()
  )
$$;
```

| Tabela | Cliente | Profissional atribuído | Admin |
|---|---|---|---|
| `process_stages.fields` | lê | lê e escreve | lê e escreve |
| `pendencies` | lê as do processo dele | tudo | tudo |
| `process_notes` | **nenhum acesso** | tudo | tudo |
| `notifications` | só as próprias | só as próprias | só as próprias |
| `approval_requests` | nenhum acesso | cria e lê | decide |
| `chat_reads` | só a própria | só a própria | só a própria |

`process_stages.fields` ser legível pelo cliente é deliberado: são dados do andamento do caso
dele (data da vistoria, número do protocolo), não conversa interna. O que é interno vai para
`process_notes`.

---

## Notificações

### Etapa 1 — sino no sistema (este spec)

Gatilhos gravam em `notifications`. O painel mostra o contador de não lidas no sino que já
existe, e a seção Notificações — hoje vazia — passa a listar.

Atualização por realtime, com o mesmo padrão dos documentos: o canal avisa, a consulta busca
respeitando a RLS.

### Etapa 2 — resumo por e-mail (depois)

Exige um `cron job` no Supabase agrupando as não lidas e disparando pelo Resend. Fica para
depois de o sino estar rodando, para não atrasar o que já entrega valor.

A coluna `profiles.settings.notifEmail` — hoje salva e nunca lida — passa a valer nessa etapa.
Enquanto isso, o interruptor no painel ganha a marca **"em breve"**, para não prometer o que
não acontece.

---

## Interface

### Painel do profissional

**Etapa 1** deixa de ter checklist fixo e passa a listar os documentos reais, nos três estados.

**Campos técnicos** das etapas 2 a 5 continuam iguais na aparência, mas salvam em
`process_stages.fields` com indicação de "salvando" e "salvo".

**Pendências** ganham o tipo de documento opcional no formulário. Com tipo, viram tarefa
acionável para o cliente.

**Concluir o processo** passa a abrir pedido de aprovação, com aviso de que aguarda o admin.

**Anotações internas** ganham o rótulo explícito "Só a equipe vê".

### Painel do cliente

**"O que falta de você"** passa a listar as pendências abertas. Com `kind`, traz o botão de
envio já com o tipo definido — o cliente não escolhe nada, só manda o arquivo.

### Painel do admin

**Nova tela `/admin/aprovacoes-processo`**, ou uma aba na de aprovações que já existe, listando
os pedidos pendentes com contexto: qual processo, quem pediu, o que quer fazer.

---

## Erros e falhas

| Situação | Comportamento |
|---|---|
| Campo salvo com o processo aberto em duas abas | Última escrita vence; sem trava, o dado é do mesmo autor |
| Pendência resolvida e reaberta pelo cliente | Enviar o mesmo tipo de novo não reabre; o profissional reabre à mão |
| Notificação de processo apagado | `on delete cascade` limpa junto |
| Aprovação decidida duas vezes | Gatilho recusa mudar pedido que não está `pendente` |
| Cliente tenta ler `process_notes` | Sem política, a consulta volta vazia |

---

## Testes

**Autorização — em `BEGIN/ROLLBACK`, como o teste de documentos**
- Cliente **não** lê `process_notes` nem por consulta direta
- Cliente lê só as pendências do processo dele
- Profissional não atribuído não lê pendência nem campo de etapa
- Cliente não enxerga `approval_requests`
- Cada um só vê as próprias notificações

**Regras impostas no banco**
- Profissional não muda `properties.status` para `entregue` sem aprovação
- Profissional não marca `deleted_at` em documento sem aprovação
- Admin faz as duas coisas direto
- Pedido já decidido não muda de novo

**Automações**
- Cliente envia documento do tipo pedido → pendência daquele `kind` fecha sozinha
- Mensagem do cliente gera notificação para o profissional, e não para ele mesmo

**Migração**
- Processo sem `fields` continua abrindo, com os campos vazios

---

## Arquivos afetados

**Novos**
- `supabase/migrations/2026MMDD_trabalho_profissional.sql`
- `supabase/migrations/verificacao/2026MMDD_teste_rls_trabalho.sql`
- `src/lib/api/pendencias.ts`
- `src/lib/api/notificacoes.ts`
- `src/lib/api/etapas.ts`
- `src/lib/api/aprovacoes.ts`
- `src/components/documentos/ChecklistDocumentos.tsx`
- `src/components/notificacoes/SinoNotificacoes.tsx`
- `src/routes/admin/aprovacoes-processo.tsx`

**Modificados**
- `src/routes/painel-profissional.tsx` — tira o `localStorage`, usa as APIs novas
- `src/routes/dashboard.tsx` — pendências na caixa "O que falta de você"
- `src/components/admin/AdminSidebar.tsx` — item de aprovações de processo
- `src/integrations/supabase/types.ts`

---

## Migração dos dados existentes

Nenhuma. O que está em `localStorage` fica em navegadores que não temos como alcançar, e a base
foi zerada em 2026-08-15. Os processos novos nascem com o modelo novo.
