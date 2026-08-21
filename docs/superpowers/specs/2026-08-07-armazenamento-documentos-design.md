# Armazenamento de documentos com versionamento — Design

**Data:** 2026-08-07
**Escopo:** Frente 1 de 4 (ver [Contexto e ordem](#contexto-e-ordem-das-frentes))
**Status:** aguardando revisão do usuário

---

## Problema

Hoje nenhum arquivo é armazenado. Tanto o painel do cliente (`src/routes/dashboard.tsx:268`)
quanto o do profissional (`src/routes/painel-profissional.tsx:533`) apenas inserem uma linha
em `documents` com nome, tamanho e status `"Enviado"`. Os bytes são descartados quando a
página fecha. Não existe uma única chamada ao Supabase Storage no projeto, e a coluna
`documents.file_path` nunca foi escrita.

A consequência não é só o arquivo faltar. O cliente envia a matrícula, vê "Enviado" e acredita
que entregou. O profissional vê o documento listado e acredita que recebeu. Os dois estão
enganados até alguém tentar abrir. Numa plataforma de regularização, onde a documentação é o
produto, isso corrói a confiança no sistema inteiro.

## Objetivo

Guardar arquivos de verdade, com histórico de versões, sob as restrições de segurança
definidas na diretriz de segurança do projeto (`CLAUDE.md`).

Critérios de sucesso:

1. Um arquivo enviado pode ser aberto depois, por quem tem direito a ele
2. Substituir um arquivo preserva o anterior e quem o enviou
3. Cliente não enxerga peça técnica do profissional antes da entrega
4. Nenhum arquivo é acessível sem autorização verificada no servidor
5. Nenhum nome de arquivo enviado pelo usuário influencia caminho no disco

## Fora de escopo

- Migração do trabalho do profissional que está em `localStorage` (frente 2)
- Sincronização de status da etapa 3 após delegação (frente 3)
- Caixa "O que falta de você" ativa (frente 4)
- Versionamento de `.docx` e outros formatos além de PDF/JPEG/PNG
- Antivírus e verificação de malware no conteúdo

---

## Contexto e ordem das frentes

O trabalho total conversado com o usuário tem quatro frentes. A ordem não é arbitrária:

| # | Frente | Por que nesta posição |
|---|--------|------------------------|
| 1 | **Armazenamento de documentos** (este spec) | Está quebrado e enganando usuário |
| 2 | Sincronização de status da etapa 3 | Barata; o dado já existe em `assigned_professional_id` |
| 3 | Trabalho do profissional sai do `localStorage` | Cria pendências, que precisam de onde aterrissar |
| 4 | Caixa "O que falta de você" ativa | Só faz sentido quando há documento a exigir (1) e pendência a mostrar (3) |

---

## Modelo de dados

### `documents` — o documento lógico

Deixa de representar "um arquivo" e passa a representar o documento como conceito
("a matrícula do imóvel"), que sobrevive a várias versões.

```sql
-- Colunas adicionadas à tabela existente
kind                text        not null default 'outro'   -- tipo (ver Tipos de documento)
origem              text        not null default 'cliente' -- 'cliente' | 'profissional'
current_version_id  uuid        references public.document_versions(id)
created_by          uuid        references auth.users(id)
deleted_at          timestamptz                            -- exclusão lógica
```

A coluna `file_path` é abandonada (mantida por compatibilidade, nunca lida). Quem manda
passa a ser `current_version_id`.

`deleted_at` implementa a exigência de que admin possa "excluir" sem apagar histórico:
a linha some das listagens, o histórico e os arquivos permanecem.

### `document_versions` — cada envio

```sql
create table public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents(id) on delete cascade,
  version_number  int  not null,
  storage_path    text not null unique,
  original_name   text not null,       -- exibição apenas; nunca compõe caminho
  mime_type       text not null,
  size_bytes      bigint not null,
  checksum_sha256 text not null,
  uploaded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (document_id, version_number)
);
```

`checksum_sha256` permite provar que o arquivo entregue a um cartório é bit a bit o que está
guardado — é o que sustenta o argumento numa exigência contestada.

### Tipos de documento (`kind`)

O cliente é obrigado a informar o que está enviando (regra 1 do usuário). Valores iniciais:

| `kind` | Rótulo | Origem típica |
|--------|--------|---------------|
| `matricula` | Matrícula / escritura | cliente |
| `iptu` | IPTU atualizado | cliente |
| `identidade` | RG e CPF do proprietário | cliente |
| `planta` | Planta do imóvel | cliente |
| `habite_se` | Habite-se | cliente |
| `ccir_car` | CCIR / CAR (rural) | cliente |
| `art_rrt` | ART / RRT | profissional |
| `laudo` | Laudo técnico | profissional |
| `projeto` | Projeto técnico | profissional |
| `protocolo` | Comprovante de protocolo | profissional |
| `outro` | Outro | ambos |

Ficam em `src/lib/document-kinds.ts`, fonte única para o seletor do cliente, o do profissional
e os rótulos das listagens.

### Amarração de versão no upload do cliente

Ao enviar, o cliente escolhe o tipo. O sistema então:

- Existe documento não-excluído com aquele `kind` e `origem='cliente'` no processo?
  → nova versão dele (`version_number` = máximo + 1)
- Não existe? → cria `documents` e a versão 1

O cliente nunca escolhe "qual documento substituir" numa lista — escolhe o tipo, e o sistema
resolve. Menos decisão para quem não conhece o modelo de dados.

---

## Organização no Storage

### Bucket

`documentos`, com `public = false`. Sem URL pública em nenhuma hipótese.

Limites configurados no próprio bucket, além da validação na função:

```
file_size_limit    = 26214400          -- 25 MB
allowed_mime_types = application/pdf, image/jpeg, image/png
```

Dois lugares de propósito: se algum dia existir caminho direto ao Storage, o limite do bucket
ainda vale.

### Caminho

```
documentos/{property_id}/{document_id}/{version_id}
```

**O nome do arquivo não entra no caminho.** São três UUIDs gerados pelo servidor.

Isto não *sanitiza* path traversal — elimina a classe inteira. `../../etc/passwd`, `..%2f`,
byte nulo, unicode de dupla codificação, nome de 4000 caracteres: nada disso importa, porque
o nome nunca compõe caminho. Ele vive em `original_name`, uma coluna de texto.

Sanitizar nome por lista de bloqueio é uma corrida que se perde com frequência. Não usar o
nome é uma decisão que não tem como falhar.

`property_id` vir primeiro permite que a RLS do Storage decida acesso pelo prefixo,
reaproveitando `can_access_property()` — já existente e já auditada. Um único conceito de
autorização vale para linha de banco e para arquivo.

---

## Autorização

### Regras (definidas pelo usuário)

**Cliente**
- Envia e versiona apenas documentos de `origem = 'cliente'` do próprio processo
- **Não lê** documentos de `origem = 'profissional'` durante o andamento
- Passa a ler as peças técnicas quando `properties.status = 'entregue'`
- Não exclui nada

**Profissional atribuído e admin**
- Leem tudo, em qualquer fase
- Enviam e versionam qualquer documento, de qualquer origem
- Excluem logicamente (`deleted_at`); histórico e arquivos permanecem

### Funções de decisão

Uma fonte de verdade, usada pela RLS das tabelas, pela RLS do Storage e pela edge function.
Se as três divergirem, uma delas vira brecha.

```sql
-- Leitura: aplica a trava de visibilidade do cliente
create or replace function public.can_read_document(_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.documents d
    join public.properties p on p.id = d.property_id
    where d.id = _document_id
      and (
        public.is_admin()
        or p.assigned_professional_id = auth.uid()
        or (
          p.client_id = auth.uid()
          and ( d.origem = 'cliente' or p.status = 'entregue' )
        )
      )
  )
$$;

-- Escrita (nova versão): cliente só mexe no que é dele
create or replace function public.can_write_document(_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.documents d
    join public.properties p on p.id = d.property_id
    where d.id = _document_id
      and (
        public.is_admin()
        or p.assigned_professional_id = auth.uid()
        or ( p.client_id = auth.uid() and d.origem = 'cliente' )
      )
  )
$$;
```

Ambas com `REVOKE ... FROM PUBLIC, anon` e `GRANT` para `authenticated, service_role`.

### RLS do `storage.objects`

A política extrai `document_id` do caminho e delega à mesma função:

```sql
create policy "documentos_read" on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and public.can_read_document( ((storage.foldername(name))[2])::uuid )
);
```

Escrita e exclusão diretas no bucket ficam **negadas para `authenticated`**: só a edge
function (com `service_role`) grava. Isso garante que nenhum arquivo entre sem passar pela
validação.

---

## Caminho do upload

```
navegador → edge function upload-documento → Storage
                        ↓
              documents + document_versions
```

### Por que passar pela função

Validação no navegador serve ao usuário, não ao atacante. `accept=".pdf"` e checagem de
`file.type` melhoram a experiência de quem age de boa-fé e são contornadas por quem não age,
porque quem controla o cliente controla o que o cliente diz. O `Content-Type` recebido é
declaração do remetente, não fato verificado.

A alternativa (URL assinada de upload + validação posterior) escala melhor, mas cria uma
janela com arquivo não-validado no bucket e exige quarentena, máquina de estados e tratamento
de órfão. Para o volume deste projeto, essa complexidade custa mais em bug do que entrega em
desempenho. Menos estados é uma propriedade de segurança.

### Ordem de validação

Falha em qualquer passo aborta tudo; nada fica pela metade.

1. **Autenticação** — sessão válida via `Authorization: Bearer`. Sem isso, 401.

2. **Autorização** — `can_write_document(document_id)` para nova versão, ou
   `can_access_property(property_id)` + origem coerente para documento novo. Sem isso, 403.
   Esta é a resposta ao risco de "forjar requisição para alterar documento de terceiro":
   o alvo é sempre verificado contra a identidade do token.

3. **Tamanho** — acima de 25 MB (26.214.400 bytes), 413 com a mensagem de arquivo grande.

4. **Assinatura real do conteúdo** — lê os primeiros bytes e compara com o tipo declarado:

   | Tipo | Bytes iniciais |
   |------|----------------|
   | PDF | `25 50 44 46 2D` (`%PDF-`) |
   | JPEG | `FF D8 FF` |
   | PNG | `89 50 4E 47 0D 0A 1A 0A` |

   Divergência entre conteúdo e declaração → 400. É aqui que morre o "HTML disfarçado de PDF".

5. **Lista de permissão** — só PDF, JPEG e PNG. Tudo o mais é recusado por padrão, inclusive
   o que ainda não foi inventado.

   Dois tipos ficam explicitamente fora e o motivo precisa estar registrado:
   - **SVG** é XML que aceita `<script>`. É imagem para o olho e código para o navegador —
     vetor clássico de XSS armazenado.
   - **HTML** pelo motivo óbvio.

   `.docx` fica fora por ora: é um zip que pode carregar macro. Se surgir a necessidade,
   reavaliar pedindo ao cliente que envie em PDF.

6. **Normalização do nome** — `original_name` é dado, não caminho. Antes de gravar:
   remove caracteres de controle (`\x00-\x1f`), corta em 255 caracteres, rejeita nome vazio.
   Acentuação e espaços são preservados: nome de arquivo em português é legítimo, e
   descaracterizá-lo destrói informação do usuário sem ganho de segurança.

7. **Gravação** — escreve no Storage com caminho de UUIDs, calcula SHA-256, insere
   `document_versions`, atualiza `documents.current_version_id`.

8. **Cota** — mesma tabela `ai_usage` já criada, chave distinta. Endpoint que grava arquivo
   sem limite de frequência é convite a encher o bucket.

### CORS

Restrito às origens conhecidas (`atoregulariza.com.br`, `curso.atoregulariza.com.br`,
`localhost:8080`), como na `admin-chat`. Nunca `*`.

---

## Leitura e preview

A URL assinada é pedida **no momento de abrir** o arquivo, não junto com a listagem: os 5
minutos de validade começam quando o arquivo é realmente aberto, e uma lista de 20 documentos
não gera 20 links vivos à toa.

Geração via edge function `documento-url`, que confere `can_read_document()` antes de assinar.

### Origem cruzada como última rede

A URL assinada aponta para `fmscewpxmqnbodzstiqa.supabase.co`, **origem diferente** de
`atoregulariza.com.br`. Se algum conteúdo ativo escapasse de todas as validações, executaria
no contexto do domínio do Storage — sem acesso à sessão, ao token ou ao `localStorage` do
site. Existe de graça, só por não hospedarmos arquivo no domínio próprio.

### Ajuste obrigatório na CSP

O `vercel.json` criado no hardening libera `frame-src` apenas para o YouTube, o que bloquearia
o preview de PDF. Precisa incluir o domínio do Storage:

```
frame-src https://www.youtube-nocookie.com https://www.youtube.com https://fmscewpxmqnbodzstiqa.supabase.co;
```

`img-src` já contempla `https://*.supabase.co`.

---

## Interface

### Preview

Modal sobre a página. PDF em `<iframe>`, imagem em `<img>`, ambos na URL assinada. Rodapé com
nome original, tamanho, autor, data e botão de baixar.

### Histórico

Na lista, o documento aparece uma vez — a versão vigente. Havendo mais de uma, marcador
discreto `v3 · ver histórico`, que abre número, data, autor e tamanho de cada anterior, todas
abríveis no mesmo preview.

**Só profissional e admin veem o histórico.** Mostrar ao cliente "você errou 3 vezes" não
ajuda; o histórico existe para proteger a equipe numa exigência de cartório, que é conversa
interna.

### Envio pelo cliente

Seletor de tipo obrigatório antes do arquivo. Sem tipo escolhido, o botão fica desabilitado —
é o que permite amarrar a versão ao registro certo.

### Estados de erro

Todos dizem o que fazer, não só o que deu errado:

- **Acima de 25 MB** — "Este arquivo tem 38 MB e o limite é 25 MB. Envie uma versão comprimida
  ou mande para `[PENDÊNCIA: e-mail do admin]` que a equipe anexa ao seu processo."
- **Tipo recusado** — "Aceitamos PDF, JPEG e PNG. Converta o arquivo e tente de novo."
- **Conteúdo não confere** — "Não conseguimos validar este arquivo. Ele pode estar corrompido —
  tente gerar novamente." Deliberadamente vago: se for tentativa de ataque, não entregamos
  qual checagem pegou.

Barra de progresso durante o envio. O status vira "Enviado" **somente após confirmação da
função** — nunca otimista. Foi a mentira do "Enviado" sem arquivo que originou este trabalho.

---

## Respostas às exigências de segurança levantadas

### SQL injection

Sem superfície. Todas as consultas usam o client Supabase (PostgREST), que parametriza. Não há
SQL cru concatenado no projeto. As funções SQL recebem parâmetros tipados (`uuid`) e usam
`SET search_path = public`, protegidas inclusive contra sequestro de `search_path` — a falha
clássica de `SECURITY DEFINER`.

**Regra permanente:** se algum dia for necessário SQL cru, usar parâmetros posicionais, nunca
concatenação de string.

### XSS

React escapa por padrão todo valor interpolado em JSX, incluindo `original_name`. A defesa
principal é essa, somada a três decisões:

1. O nome nunca compõe caminho, URL ou HTML bruto
2. `dangerouslySetInnerHTML` é proibido com dado de usuário (diretriz do projeto)
3. SVG não é aceito, então não existe arquivo servido que possa carregar script

Caracteres de controle são removidos na gravação; acentuação é preservada.

### CSRF — por que tokens não se aplicam aqui

CSRF funciona porque o navegador anexa **cookies** automaticamente em requisição cross-site.
O Supabase não usa cookie: a sessão vive no `localStorage` e vai no header
`Authorization: Bearer`, montado por JavaScript a cada chamada. Nenhum navegador anexa esse
header sozinho em requisição cross-site. Um formulário hostil em outro domínio consegue
disparar a requisição, mas ela chega sem token e é recusada com 401 antes de tocar em dado.

Implementar tokens CSRF adicionaria código que nunca rejeita nada real, mais um estado para
sincronizar e quebrar, e a anotação "CSRF: protegido" numa auditoria futura — escondendo que
a proteção real vem de outro lugar.

O risco concreto por trás da preocupação — *forjar requisição para alterar documento de
terceiro* — é de **autorização**, e está tratado: toda operação verifica o alvo contra a
identidade do token, na edge function e novamente na RLS.

**Condição que muda esta decisão:** se a sessão migrar para cookie (por exemplo, ao adotar
auth por SSR), tokens CSRF passam a ser obrigatórios, junto de `SameSite=Lax` ou `Strict`.
Revisar este spec nesse dia.

---

## Erros e falhas

| Situação | Comportamento |
|----------|---------------|
| Falha ao escrever no Storage | Nenhuma linha criada; erro ao usuário; nada órfão |
| Falha ao inserir a versão após gravar | Arquivo removido do Storage; erro ao usuário |
| Duas versões enviadas ao mesmo tempo | `unique (document_id, version_number)` barra; refaz a numeração e repete |
| URL assinada expirada | Pede outra ao reabrir; transparente |
| Documento excluído logicamente | Some das listagens; arquivos e histórico preservados |

---

## Testes

**Autorização** (os que provam as regras do usuário)
- Cliente **não** lê documento `origem='profissional'` com processo em andamento
- Mesmo cliente **lê** o mesmo documento quando `status='entregue'`
- Cliente **não** cria versão em documento `origem='profissional'`
- Cliente de um processo **não** lê documento de outro processo
- Profissional não atribuído **não** lê documento do processo

**Validação de arquivo**
- HTML renomeado para `.pdf` é recusado (assinatura não confere)
- SVG é recusado
- Arquivo de 26 MB é recusado
- Nome `../../../etc/passwd` grava normalmente e o caminho no bucket permanece só UUIDs
- Nome com acento é preservado em `original_name`

**Versionamento**
- Segundo envio do mesmo `kind` cria versão 2 e atualiza `current_version_id`
- Versão 1 continua acessível e com o `checksum` original
- Exclusão lógica some da lista sem apagar versões

---

## Pendências do usuário

- **E-mail do admin para arquivos grandes** — precisa ser criado. Até lá, a mensagem de erro
  fica com o marcador `[PENDÊNCIA: e-mail do admin]`. Substituir antes de ir a produção.

---

## Arquivos afetados

**Novos**
- `supabase/migrations/2026MMDD_documentos_storage.sql` — tabelas, funções, RLS, bucket
- `supabase/functions/upload-documento/index.ts` — recebe, valida e grava
- `supabase/functions/documento-url/index.ts` — gera URL assinada após checar permissão
- `src/lib/document-kinds.ts` — tipos de documento, fonte única
- `src/lib/api/documentos.ts` — client de upload, listagem e URL assinada
- `src/components/documentos/DocumentPreview.tsx` — modal de preview
- `src/components/documentos/DocumentList.tsx` — lista com versão vigente e histórico
- `src/components/documentos/UploadDocumento.tsx` — seletor de tipo + envio

**Modificados**
- `src/routes/dashboard.tsx` — usa os componentes novos no lugar do upload falso
- `src/routes/painel-profissional.tsx` — idem, mais o histórico de versões
- `src/routes/admin/documentos.tsx` — acesso total e exclusão lógica
- `src/integrations/supabase/types.ts` — tipos das colunas e tabela novas
- `vercel.json` — `frame-src` com o domínio do Storage
