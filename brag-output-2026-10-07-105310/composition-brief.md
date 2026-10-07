# Hyperframes Composition Brief: Ato Regulariza

## Objective
Reels vertical, jovem e dinâmico, apresentando a plataforma Ato Regulariza.

## Output
- Composition directory: `brag-output-2026-10-07-105310/composition/`
- Rendered video: `brag-output-2026-10-07-105310/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 28,5 s (pedido do usuário: ~30 s)

## Source Material
- Project root: `/home/claude/b4dctrl/atto-regulariza`
- Primary files read: `src/styles.css`, `src/components/landing/{Hero,HowItWorks,BentoFeatures,FinalCTA,IntroCards}.tsx`
- Product name: Ato Regulariza
- Strongest claim: "Regularize seu imóvel em semanas, não em meses."
- UI moments to recreate: mapa cadastral do hero; 5 passos do HowItWorks; painel com "68% concluído · sem atrasos"; botão "Avaliação gratuita no WhatsApp"

## Creative Direction
- Tone preset: default · direção "Reels jovem": cortes secos, texto grande, fala de conversa
- Avoid: REURB/usucapião/adjudicação compulsória, nomes de pessoas, preços, sócios, SaaS genérico

## Visual Identity
- Background `#FBF9F6` · Surface `#F6F2ED` · Text `#15100C` · Accent `#EA6134`
- Display: Instrument Serif · Body: Inter

## Audio
- Voz: `assets/vo/s1..s6.wav` (Kokoro pf_dora, pt-br), uma faixa, sem sobreposição
- Música: `assets/music/bed.mp3` (vol-10), baixa por baixo da voz, fade in/out
- Cues: `assets/music/cues.json` — usar o strongCue 22,92 s e a grade de batidas
- SFX: `assets/sfx/*.ogg`, só em ações (cartão, passo, 68 %, CTA)
- Áudio-reativo: omitido (voz contínua, música baixa)

## Hyperframes Instructions
Skills carregadas: hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-cli. Rodar `npx hyperframes check` antes de qualquer render.
