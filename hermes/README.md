# Hermes no ATTO (Oracle Always Free)

## 1. Criar a VM
- Oracle Cloud > Compute > Create instance > Ubuntu 22.04/24.04, shape `VM.Standard.A1.Flex`.
- Comece com 1-2 OCPU e 6-12 GB; aumente depois (limite gratis: 4 OCPU / 24 GB).
- Erro "Out of host capacity": teste outro Availability Domain, outro horario,
  menos recursos, ou faca upgrade para Pay As You Go (continua gratis dentro dos limites).
- Firewall (Security List): deixe so a porta 22 (SSH), de preferencia so pro seu IP.

## 2. Instalar Docker
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER   # sair e entrar de novo

## 3. Subir o Hermes
    git clone https://github.com/B4dCtrl/Atto-Regulariza && cd Atto-Regulariza/hermes
    cp .env.example .env && nano .env
    docker compose up -d
    docker compose logs -f

## 4. Configurar modelos por funcao
    docker compose exec -it hermes hermes model
Gerente: Claude Sonnet. Triagem/rotinas: Haiku ou modelo gratis.
Nao envie dados pessoais de clientes a modelos gratuitos.

## Seguranca
- Comece em modo rascunho: o Hermes responde so a EMAIL_ALLOWED_USERS (equipe).
- Conta de e-mail dedicada; nunca a caixa pessoal de alguem.
- Acesso ao Supabase so com papel restrito (fase seguinte), jamais SERVICE_ROLE_KEY.
