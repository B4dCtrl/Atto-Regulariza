# Modelos de e-mail — Supabase Auth

Textos em português com a identidade da Ato Regulariza, para colar em
**Supabase › Authentication › Emails**, aba de cada modelo, campo **Source**.

Só destravam com SMTP próprio configurado (Resend), o que já foi feito.

## Variáveis do Supabase usadas aqui

| Variável | O que vira |
|---|---|
| `{{ .ConfirmationURL }}` | Link de ação, com o token embutido |
| `{{ .Email }}` | E-mail de quem recebe |
| `{{ .SiteURL }}` | A Site URL configurada no projeto |

## Princípios adotados nos textos

- **Dizer o que a ação faz antes de pedir o clique.** E-mail que só traz um botão
  "Confirmar" treina o usuário a clicar sem ler — exatamente o hábito que golpe de phishing
  explora. Numa plataforma que trata matrícula e CPF, isso importa.
- **Avisar o que fazer se não foi você.** Toda mensagem tem essa linha.
- **Link visível em texto**, além do botão. Cliente de e-mail que bloqueia HTML ainda
  funciona, e quem quiser conferir o destino antes de clicar consegue.
- **Sem imagem externa.** Muitos clientes bloqueiam por padrão, e um e-mail que chega
  quebrado passa impressão de fraude.
- **Prazo de validade explícito**, para a pessoa não guardar o link para depois.

---

## 1. Confirmar cadastro (Confirm signup)

**Subject:** `Confirme seu e-mail — Ato Regulariza`

```html
<div style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px;">

    <div style="font-size:20px;letter-spacing:-0.3px;color:#1a1a1a;font-weight:600;">ato</div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8580;margin-top:2px;">Regulariza</div>

    <h1 style="font-size:24px;line-height:1.3;color:#1a1a1a;margin:28px 0 12px;font-weight:600;">
      Confirme seu e-mail
    </h1>

    <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 20px;">
      Recebemos um cadastro na Ato Regulariza com este endereço. Confirme que é você para
      liberar o acesso ao seu painel.
    </p>

    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">
      Confirmar meu e-mail
    </a>

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:24px 0 0;">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="color:#57534e;word-break:break-all;">{{ .ConfirmationURL }}</span>
    </p>

    <hr style="border:none;border-top:1px solid #eeebe7;margin:28px 0;">

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:0;">
      O link vale por 24 horas.<br>
      <strong style="color:#57534e;">Não foi você que se cadastrou?</strong> Ignore esta
      mensagem — sem a confirmação, nenhuma conta é criada com o seu e-mail.
    </p>

  </div>
</div>
```

---

## 2. Recuperar senha (Reset password)

**Subject:** `Redefinir sua senha — Ato Regulariza`

```html
<div style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px;">

    <div style="font-size:20px;letter-spacing:-0.3px;color:#1a1a1a;font-weight:600;">ato</div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8580;margin-top:2px;">Regulariza</div>

    <h1 style="font-size:24px;line-height:1.3;color:#1a1a1a;margin:28px 0 12px;font-weight:600;">
      Criar uma senha nova
    </h1>

    <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 20px;">
      Alguém pediu a redefinição de senha da conta <strong style="color:#1a1a1a;">{{ .Email }}</strong>.
      Clique abaixo para escolher uma senha nova.
    </p>

    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">
      Criar senha nova
    </a>

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:24px 0 0;">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="color:#57534e;word-break:break-all;">{{ .ConfirmationURL }}</span>
    </p>

    <hr style="border:none;border-top:1px solid #eeebe7;margin:28px 0;">

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:0;">
      O link vale por 1 hora e só pode ser usado uma vez.<br>
      <strong style="color:#57534e;">Não foi você?</strong> Ignore esta mensagem. Sua senha
      atual continua valendo e nada muda na sua conta.
    </p>

  </div>
</div>
```

---

## 3. Convite (Invite user)

**Subject:** `Você foi convidado para a Ato Regulariza`

```html
<div style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px;">

    <div style="font-size:20px;letter-spacing:-0.3px;color:#1a1a1a;font-weight:600;">ato</div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8580;margin-top:2px;">Regulariza</div>

    <h1 style="font-size:24px;line-height:1.3;color:#1a1a1a;margin:28px 0 12px;font-weight:600;">
      Seu acesso está pronto
    </h1>

    <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 20px;">
      A equipe da Ato Regulariza criou um acesso para você. Defina sua senha para entrar e
      acompanhar a regularização do imóvel.
    </p>

    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">
      Definir minha senha
    </a>

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:24px 0 0;">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="color:#57534e;word-break:break-all;">{{ .ConfirmationURL }}</span>
    </p>

    <hr style="border:none;border-top:1px solid #eeebe7;margin:28px 0;">

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:0;">
      <strong style="color:#57534e;">Não esperava este convite?</strong> Ignore esta
      mensagem — sem definir a senha, o acesso não é ativado.
    </p>

  </div>
</div>
```

---

## 4. Trocar e-mail (Change email address)

**Subject:** `Confirme seu novo e-mail — Ato Regulariza`

```html
<div style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px;">

    <div style="font-size:20px;letter-spacing:-0.3px;color:#1a1a1a;font-weight:600;">ato</div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8580;margin-top:2px;">Regulariza</div>

    <h1 style="font-size:24px;line-height:1.3;color:#1a1a1a;margin:28px 0 12px;font-weight:600;">
      Confirme seu novo e-mail
    </h1>

    <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 20px;">
      Foi pedida a troca do e-mail da sua conta na Ato Regulariza para
      <strong style="color:#1a1a1a;">{{ .Email }}</strong>. Confirme para concluir.
    </p>

    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:15px;">
      Confirmar novo e-mail
    </a>

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:24px 0 0;">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="color:#57534e;word-break:break-all;">{{ .ConfirmationURL }}</span>
    </p>

    <hr style="border:none;border-top:1px solid #eeebe7;margin:28px 0;">

    <p style="font-size:13px;line-height:1.6;color:#8a8580;margin:0;">
      <strong style="color:#57534e;">Não foi você?</strong> Ignore esta mensagem e troque a
      senha da sua conta — alguém pode ter acessado o seu acesso.
    </p>

  </div>
</div>
```

---

## Como aplicar

1. Abra <https://supabase.com/dashboard/project/fmscewpxmqnbodzstiqa/auth/templates>
2. Escolha o modelo na lista à esquerda
3. Cole o **Subject** no campo de assunto
4. No corpo, clique em **Source** (não em Preview) e substitua todo o conteúdo pelo HTML
5. **Save** em cada um, separadamente

## Depois de aplicar

Peça uma recuperação de senha para você mesmo e confira: remetente "Ato Regulariza",
texto em português, e o link levando a `/redefinir-senha`.
