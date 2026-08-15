# Modelos de e-mail — Supabase Auth

Textos em português com a identidade visual da Ato Regulariza, para colar em
**Supabase › Authentication › Emails**, no modo **Source** de cada modelo.

Cores tiradas de `src/styles.css`: laranja `#E1662E`, fundo `#FAFAF7`, texto `#1A1A1A`,
texto suave `#6B6660`, borda `#E5E1DC`.

## Variáveis do Supabase

| Variável | Vira |
|---|---|
| `{{ .ConfirmationURL }}` | Link de ação com o token |
| `{{ .Email }}` | E-mail de quem recebe |

## Sobre o logo no header

O `<img>` aponta para `https://www.atoregulariza.com.br/ato-lockup.png`, servido pelo próprio
site. Muitos clientes bloqueiam imagem de remetente novo, então o header traz **também** o
nome em texto: bloqueada a imagem, o cabeçalho continua com a marca e a faixa laranja, em vez
de mostrar um quadrado quebrado — que é o que faz e-mail parecer golpe.

## Decisões de conteúdo

- A ação é explicada **antes** do botão. E-mail que só mostra "Confirmar" treina a pessoa a
  clicar sem ler, que é o hábito de que o phishing vive — sério numa plataforma que trata
  matrícula e CPF.
- Toda mensagem diz o que fazer **se não foi você**.
- Link em texto além do botão, para cliente que bloqueia HTML.
- Prazo de validade explícito.

---

## 1. Confirmar cadastro (Confirm signup)

**Subject:** `Confirme seu e-mail — Ato Regulariza`

```html
<div style="margin:0;padding:0;background:#F1EEE9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EEE9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FAFAF7;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,26,26,0.06);">

  <tr>
    <td style="background:#1A1A1A;padding:24px 32px;">
      <img src="https://www.atoregulariza.com.br/ato-lockup.png" alt="Ato Regulariza" width="132" style="display:block;border:0;max-width:132px;height:auto;">
      <div style="color:#FAFAF7;font-size:17px;font-weight:600;letter-spacing:-0.2px;margin-top:4px;">Ato Regulariza</div>
      <div style="color:#E1662E;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px;">Regularização de imóveis</div>
    </td>
  </tr>

  <tr><td style="height:4px;background:#E1662E;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:36px 32px 32px;">
      <h1 style="font-size:23px;line-height:1.3;color:#1A1A1A;margin:0 0 14px;font-weight:600;">Confirme seu e-mail</h1>

      <p style="font-size:15px;line-height:1.65;color:#6B6660;margin:0 0 24px;">
        Recebemos um cadastro na Ato Regulariza com este endereço. Confirme que é você para
        liberar o acesso ao seu painel e acompanhar a regularização do seu imóvel.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#1A1A1A;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 30px;color:#FAFAF7;text-decoration:none;font-size:15px;font-weight:500;border-radius:999px;">Confirmar meu e-mail</a>
      </td></tr></table>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:26px 0 0;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="color:#1A1A1A;word-break:break-all;">{{ .ConfirmationURL }}</span>
      </p>

      <div style="height:1px;background:#E5E1DC;margin:28px 0;"></div>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:0;">
        O link vale por 24 horas.<br>
        <strong style="color:#1A1A1A;">Não foi você que se cadastrou?</strong> Ignore esta
        mensagem — sem a confirmação, nenhuma conta é criada com o seu e-mail.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#F1EEE9;padding:18px 32px;text-align:center;">
      <div style="font-size:12px;color:#6B6660;">Ato Regulariza · Regularização de imóveis</div>
      <div style="font-size:11px;color:#9A948C;margin-top:4px;">Mensagem automática — não responda a este e-mail.</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</div>
```

---

## 2. Recuperar senha (Reset password)

**Subject:** `Redefinir sua senha — Ato Regulariza`

```html
<div style="margin:0;padding:0;background:#F1EEE9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EEE9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FAFAF7;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,26,26,0.06);">

  <tr>
    <td style="background:#1A1A1A;padding:24px 32px;">
      <img src="https://www.atoregulariza.com.br/ato-lockup.png" alt="Ato Regulariza" width="132" style="display:block;border:0;max-width:132px;height:auto;">
      <div style="color:#FAFAF7;font-size:17px;font-weight:600;letter-spacing:-0.2px;margin-top:4px;">Ato Regulariza</div>
      <div style="color:#E1662E;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px;">Regularização de imóveis</div>
    </td>
  </tr>

  <tr><td style="height:4px;background:#E1662E;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:36px 32px 32px;">
      <h1 style="font-size:23px;line-height:1.3;color:#1A1A1A;margin:0 0 14px;font-weight:600;">Criar uma senha nova</h1>

      <p style="font-size:15px;line-height:1.65;color:#6B6660;margin:0 0 24px;">
        Alguém pediu a redefinição de senha da conta
        <strong style="color:#1A1A1A;">{{ .Email }}</strong>. Clique no botão abaixo para
        escolher uma senha nova.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#1A1A1A;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 30px;color:#FAFAF7;text-decoration:none;font-size:15px;font-weight:500;border-radius:999px;">Criar senha nova</a>
      </td></tr></table>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:26px 0 0;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="color:#1A1A1A;word-break:break-all;">{{ .ConfirmationURL }}</span>
      </p>

      <div style="height:1px;background:#E5E1DC;margin:28px 0;"></div>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:0;">
        O link vale por 1 hora e só pode ser usado uma vez.<br>
        <strong style="color:#1A1A1A;">Não foi você?</strong> Ignore esta mensagem. Sua senha
        atual continua valendo e nada muda na sua conta.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#F1EEE9;padding:18px 32px;text-align:center;">
      <div style="font-size:12px;color:#6B6660;">Ato Regulariza · Regularização de imóveis</div>
      <div style="font-size:11px;color:#9A948C;margin-top:4px;">Mensagem automática — não responda a este e-mail.</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</div>
```

---

## 3. Convite (Invite user)

**Subject:** `Você foi convidado para a Ato Regulariza`

```html
<div style="margin:0;padding:0;background:#F1EEE9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EEE9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FAFAF7;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,26,26,0.06);">

  <tr>
    <td style="background:#1A1A1A;padding:24px 32px;">
      <img src="https://www.atoregulariza.com.br/ato-lockup.png" alt="Ato Regulariza" width="132" style="display:block;border:0;max-width:132px;height:auto;">
      <div style="color:#FAFAF7;font-size:17px;font-weight:600;letter-spacing:-0.2px;margin-top:4px;">Ato Regulariza</div>
      <div style="color:#E1662E;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px;">Regularização de imóveis</div>
    </td>
  </tr>

  <tr><td style="height:4px;background:#E1662E;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:36px 32px 32px;">
      <h1 style="font-size:23px;line-height:1.3;color:#1A1A1A;margin:0 0 14px;font-weight:600;">Seu acesso está pronto</h1>

      <p style="font-size:15px;line-height:1.65;color:#6B6660;margin:0 0 24px;">
        A equipe da Ato Regulariza criou um acesso para você. Defina sua senha para entrar e
        acompanhar cada etapa da regularização.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#1A1A1A;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 30px;color:#FAFAF7;text-decoration:none;font-size:15px;font-weight:500;border-radius:999px;">Definir minha senha</a>
      </td></tr></table>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:26px 0 0;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="color:#1A1A1A;word-break:break-all;">{{ .ConfirmationURL }}</span>
      </p>

      <div style="height:1px;background:#E5E1DC;margin:28px 0;"></div>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:0;">
        <strong style="color:#1A1A1A;">Não esperava este convite?</strong> Ignore esta
        mensagem — sem definir a senha, o acesso não é ativado.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#F1EEE9;padding:18px 32px;text-align:center;">
      <div style="font-size:12px;color:#6B6660;">Ato Regulariza · Regularização de imóveis</div>
      <div style="font-size:11px;color:#9A948C;margin-top:4px;">Mensagem automática — não responda a este e-mail.</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</div>
```

---

## 4. Trocar e-mail (Change email address)

**Subject:** `Confirme seu novo e-mail — Ato Regulariza`

```html
<div style="margin:0;padding:0;background:#F1EEE9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EEE9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FAFAF7;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,26,26,0.06);">

  <tr>
    <td style="background:#1A1A1A;padding:24px 32px;">
      <img src="https://www.atoregulariza.com.br/ato-lockup.png" alt="Ato Regulariza" width="132" style="display:block;border:0;max-width:132px;height:auto;">
      <div style="color:#FAFAF7;font-size:17px;font-weight:600;letter-spacing:-0.2px;margin-top:4px;">Ato Regulariza</div>
      <div style="color:#E1662E;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px;">Regularização de imóveis</div>
    </td>
  </tr>

  <tr><td style="height:4px;background:#E1662E;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:36px 32px 32px;">
      <h1 style="font-size:23px;line-height:1.3;color:#1A1A1A;margin:0 0 14px;font-weight:600;">Confirme seu novo e-mail</h1>

      <p style="font-size:15px;line-height:1.65;color:#6B6660;margin:0 0 24px;">
        Foi pedida a troca do e-mail da sua conta na Ato Regulariza para
        <strong style="color:#1A1A1A;">{{ .Email }}</strong>. Confirme para concluir a
        alteração.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#1A1A1A;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 30px;color:#FAFAF7;text-decoration:none;font-size:15px;font-weight:500;border-radius:999px;">Confirmar novo e-mail</a>
      </td></tr></table>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:26px 0 0;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br>
        <span style="color:#1A1A1A;word-break:break-all;">{{ .ConfirmationURL }}</span>
      </p>

      <div style="height:1px;background:#E5E1DC;margin:28px 0;"></div>

      <p style="font-size:13px;line-height:1.6;color:#6B6660;margin:0;">
        <strong style="color:#1A1A1A;">Não foi você?</strong> Ignore esta mensagem e troque a
        senha da sua conta — alguém pode ter acessado o seu acesso.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#F1EEE9;padding:18px 32px;text-align:center;">
      <div style="font-size:12px;color:#6B6660;">Ato Regulariza · Regularização de imóveis</div>
      <div style="font-size:11px;color:#9A948C;margin-top:4px;">Mensagem automática — não responda a este e-mail.</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</div>
```

---

## Como aplicar

1. <https://supabase.com/dashboard/project/fmscewpxmqnbodzstiqa/auth/templates>
2. Escolha o modelo na lista à esquerda
3. Cole o **Subject**
4. No corpo clique em **Source** (não Preview) e substitua tudo
5. **Save** — um modelo de cada vez
