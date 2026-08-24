# Protocolo de coleta de documentos no onboarding

**Data:** 2026-08-24

## O problema

O cliente termina o tutorial e cai no painel sem nenhuma instrução do que fazer. Não há
protocolo inicial: ele pode nunca enviar documento nenhum, e o processo fica parado sem que
ninguém perceba. Do outro lado, qualquer processo pode receber profissional a qualquer
momento — a única regra hoje é que o profissional esteja aprovado. O profissional recebe um
caso sem saber o que existe e o que falta.

## O que já existe e será reaproveitado

| Peça | Onde | Papel no novo fluxo |
|---|---|---|
| `DOCUMENT_KINDS` com `origem` | `src/lib/document-kinds.ts` | Os tipos do checklist já estão lá: `identidade`, `matricula`, `iptu`, `planta`, `habite_se`, `ccir_car` |
| `documents.status` | `Pendente / Enviado / Em análise / Aprovado` | O ciclo de vida de cada documento |
| `pendencies` + `TarefasDoCliente` | tabela e `src/components/cliente/TarefasDoCliente.tsx` | É o "O que falta de você": pendência com `kind` vira tarefa com envio embutido |
| Gatilho `ao_criar_versao_documento` | `20260816_trabalho_profissional.sql` | Fecha a pendência sozinha quando chega documento do tipo pedido |
| `enforce_assigned_professional` | `20260807_hardening_seguranca.sql` | Já barra profissional não aprovado; ganhará a segunda regra |
| Envio validado | edge function `upload-documento` | Valida tipo, tamanho e assinatura real do conteúdo |

**Metade do trabalho já está feita.** O que falta é o protocolo inicial, o estado da coleta, a
tela de análise e a trava.

## Decisões tomadas

**O analisador é a IA triando e uma pessoa confirmando** (decisão do usuário, 2026-08-24). A
IA nunca aprova sozinha: ela não consegue verificar se a matrícula está atualizada nem se a
planta corresponde ao imóvel, e documento aprovado por engano só aparece semanas depois, no
cartório.

**A trava vale só no essencial** (decisão do usuário, 2026-08-24). Identidade e comprovante de
endereço travam a delegação; matrícula, IPTU, planta e o resto viram pendência. A razão: quem
sabe dizer "no seu caso não existe matrícula, o caminho é usucapião" é exatamente o
profissional que uma trava total estaria impedindo de entrar. Metade de quem procura
regularização não tem matrícula — é por isso que procura.

## Arquitetura

Uma coluna nova, `properties.coleta`, com os quatro estados. Ela **não substitui**
`properties.status`, que desenha a barra de etapas do cliente e continua fazendo isso. São
duas perguntas diferentes: `status` responde "em que etapa o processo está"; `coleta` responde
"em que pé está a papelada".

Um tipo de documento novo: `comprovante_endereco`, origem `cliente`.

### Estados da coleta

```
PENDENTE_INICIAL  →  EM_ANALISE  →  ACAO_REQUERIDA  ⇄  EM_ANALISE
                                           ↓
                                  PRONTO_PARA_DELEGACAO
```

| Estado | Significa | Quem move |
|---|---|---|
| `PENDENTE_INICIAL` | Cliente ainda não enviou os três do checklist padrão | Nasce com o processo |
| `EM_ANALISE` | Tudo do checklist chegou; a equipe está conferindo | Gatilho, ao chegar o terceiro |
| `ACAO_REQUERIDA` | A análise pediu documentos; há pendência aberta | Admin, ao publicar a análise |
| `PRONTO_PARA_DELEGACAO` | Os essenciais estão aprovados; o caso pode andar | Gatilho, ao aprovar o essencial |

`PRONTO_PARA_DELEGACAO` **não** significa papelada completa. Significa que os essenciais
passaram. Pendência aberta e delegação convivem de propósito.

## Etapa 1 — Protocolo inicial, logo após o tutorial

Tela dedicada, **não modal**: modal se fecha e nunca mais volta.

### Checklist padrão

| Documento | `kind` | Trava a delegação |
|---|---|---|
| RG e CPF do proprietário | `identidade` | **sim** |
| Comprovante de endereço | `comprovante_endereco` | **sim** |
| Matrícula ou escritura | `matricula` | não |

Cada item é um cartão com envio direto — o mesmo `UploadDocumento` com `tipoFixo`, já usado nas
tarefas. Barra de progresso "1 de 3 enviados".

Há um botão **"Enviar depois"**. Prender a pessoa numa tela sem saída faz ela fechar a aba e
não voltar. Quem sai encontra os mesmos três itens como tarefas em "O que falta de você" — o
checklist não desaparece, muda de lugar.

### Microcopy

Topo da tela:

> **Vamos começar pelos documentos**
> Com esses três em mãos, nossa equipe consegue analisar seu caso e dizer exatamente o que
> falta. Sem eles, seu processo não sai do lugar.
>
> *Leva 2 minutos se você já tiver os arquivos no celular.*

No cartão da matrícula:

> Não tem a matrícula? Envie o contrato de compra e venda, ou pule este item — muitos imóveis
> ainda não têm registro, e é justamente isso que vamos resolver.

Botão secundário:

> Enviar depois

Ao completar os três:

> **Recebemos seus documentos.**
> Nossa equipe está conferindo. Em até 2 dias úteis você recebe aqui a lista do que ainda
> falta para o seu caso.

Em `ACAO_REQUERIDA`, na caixa "O que falta de você" (o componente já existe e já mostra a
descrição da pendência):

> A análise do seu caso pediu mais alguns documentos. Cada um abaixo tem o botão de envio.

## Etapa 2 — Análise: IA tria, pessoa confirma

### Fila

Uma seção nova no admin: **Processos em análise**, listando o que está em `EM_ANALISE`,
ordenado pelo mais antigo — quem espera há mais tempo aparece primeiro.

### Sugestão da IA

Ao abrir um processo, a IA recebe: tipo de imóvel, situação, objetivo, cidade/UF, e a lista de
documentos enviados com tipo e data. Devolve, em formato validado por schema:

- para cada documento, uma sugestão de **aprovar** ou **recusar**, com motivo em uma linha;
- uma lista de **pendências sugeridas**, cada uma com `kind` e descrição escrita para o
  cliente ler.

Exemplos da dedução esperada: casa urbana sem habite-se sugere `habite_se` e `planta`; imóvel
rural sugere `ccir_car`; objetivo de venda sugere `iptu`.

A IA **não vê o conteúdo dos arquivos** — só os metadados. Ela sugere o que costuma faltar
para aquele perfil de caso; quem olha o documento é a pessoa.

### Revisão e publicação

O admin vê tudo pré-marcado, desmarca o que discorda, acrescenta pendência própria, e
confirma. **Um clique publica a análise inteira**: os documentos recebem seu status, as
pendências são criadas, e `coleta` passa a `ACAO_REQUERIDA` (se houver pendência) ou a
`PRONTO_PARA_DELEGACAO`.

As pendências criadas aparecem para o cliente pelo caminho que já existe — tarefa com envio
embutido, fechando sozinha quando o documento do tipo pedido chega.

### Se a IA falhar

A tela abre sem sugestão nenhuma, com os documentos listados e os campos vazios, e um aviso
discreto de que a análise automática não pôde ser gerada. O admin trabalha à mão. A análise
nunca fica bloqueada por causa da IA.

## Etapa 3 — Trava e delegação

### A regra

`enforce_assigned_professional` ganha uma segunda checagem: designar profissional exige que
**todos** os documentos de tipo essencial (`identidade`, `comprovante_endereco`) do processo
estejam com `status = 'Aprovado'` e `deleted_at IS NULL`.

Fica no banco, não na tela, pelo mesmo motivo das outras regras do projeto: só na interface,
bastaria uma chamada direta à API para contornar.

A mensagem do erro diz o que falta, com nome:

> Faltam documentos essenciais aprovados: RG e CPF do proprietário.

### O que o profissional recebe

Ao abrir o caso delegado, encontra pronto, sem precisar perguntar nada:

| Bloco | Origem |
|---|---|
| Dados do imóvel | `properties`: nome, tipo, situação, objetivo, cidade/UF |
| Documentos aprovados | `documents` + `document_versions`: tipo, nome, data, versão vigente |
| Pendências ainda abertas | `pendencies` com `status = 'aberta'` |
| Parecer da análise | Texto gravado na publicação, em `process_notes` |
| Cliente | Nome e último acesso ao painel |

## Autorização

- O cliente só envia documento de tipo `origem = 'cliente'` — regra que já existe.
- Só admin publica análise: a server function confere `user_roles`, nunca papel vindo do
  cliente.
- `properties.coleta` é escrita por gatilho e pela server function de publicação; o cliente
  nunca a altera.
- A trava de delegação vive no gatilho do banco.

## Testes

**Vitest** — funções puras: quais tipos faltam para o checklist padrão dado o que já foi
enviado; se os essenciais estão aprovados; o texto do estado da coleta.

**SQL em `BEGIN … ROLLBACK`** — a trava: designar com essencial faltando falha; designar com
essenciais aprovados passa; cliente não altera `coleta`; documento excluído não conta como
aprovado.

## Fora de escopo

**Leitura do conteúdo dos documentos pela IA.** Ela recebe metadados, não os arquivos. Extrair
texto de PDF e conferir se a matrícula está atualizada é um projeto próprio, com custo e risco
distintos.

**Prazo de resposta da análise.** O texto promete "até 2 dias úteis" ao cliente, mas nada no
sistema mede nem cobra isso. Se virar promessa que não se cumpre, o próximo passo é um alerta
no painel gerencial — que já existe e já lista o que está parado.
