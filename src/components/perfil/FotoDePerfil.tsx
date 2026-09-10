/**
 * A foto de perfil — o avatar e o botão que troca a imagem.
 *
 * Nasceu para dar função a um botão de câmera que existia nos dois perfis e
 * não fazia nada. Vive aqui, e não em cada tela, porque cliente e profissional
 * mostram o mesmo círculo com as mesmas regras — duplicar significaria dois
 * lugares para corrigir quando o Storage mudar.
 *
 * O que ele resolve antes de subir:
 * - **encolhe a imagem** para 512px no navegador. A foto do celular tem 4 MB
 *   e 4000px; o círculo tem 80. Subir o original gasta banda de quem está no
 *   3G e estoura o limite do bucket sem motivo.
 * - **converte para JPEG**, que é o que o bucket aceita junto com png e webp.
 *   HEIC do iPhone entra como imagem e sairia recusado pelo Storage.
 * - **nomeia com o id da pessoa na frente** (`<user_id>/perfil-<hora>.jpg`),
 *   que é o que a política do banco exige para deixar escrever.
 *
 * O sufixo de hora existe porque o caminho vira URL pública e a URL fica em
 * cache: sem ele, trocar a foto não mudaria nada na tela por horas.
 */

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LADO = 512;
const QUALIDADE = 0.85;

/** Reduz e converte no navegador. Devolve o JPEG pronto para subir. */
async function preparar(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("navegador sem canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise<Blob>((ok, falhou) =>
    tela.toBlob(
      (b) => (b ? ok(b) : falhou(new Error("não consegui converter a imagem"))),
      "image/jpeg",
      QUALIDADE,
    ),
  );
}

type Props = {
  /** Dono da foto. É o que a política do Storage confere. */
  userId: string;
  /** Foto atual, ou nada — aí mostramos as iniciais. */
  url: string | null;
  /** Fallback: as iniciais de quem não tem foto. */
  iniciais: string;
  /** Chamado com a URL nova depois de subir, para a tela salvar no perfil. */
  aoTrocar: (url: string) => void;
  /** Tamanho do círculo em px. O botão acompanha. */
  tamanho?: number;
};

export function FotoDePerfil({ userId, url, iniciais, aoTrocar, tamanho = 80 }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolheu(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    // Permite escolher a mesma foto de novo depois de um erro: sem isto o
    // input guarda o valor e o evento não dispara na segunda vez.
    e.target.value = "";
    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      setErro("Escolha uma imagem.");
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const pronta = await preparar(arquivo);
      const caminho = `${userId}/perfil-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from("avatares")
        .upload(caminho, pronta, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from("avatares").getPublicUrl(caminho);
      aoTrocar(data.publicUrl);
    } catch (falha) {
      console.error("[foto de perfil] falhou", falha);
      setErro("Não consegui enviar a foto. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const botao = Math.max(28, Math.round(tamanho * 0.4));

  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      {url ? (
        <img
          src={url}
          alt="Foto de perfil"
          className="h-full w-full rounded-full object-cover"
          style={{ width: tamanho, height: tamanho }}
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center rounded-full bg-foreground font-medium text-background"
          style={{ fontSize: Math.round(tamanho * 0.3) }}
        >
          {iniciais}
        </div>
      )}

      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={enviando}
        aria-label={url ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
        title={url ? "Trocar foto" : "Adicionar foto"}
        className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-accent text-accent-foreground ring-2 ring-background transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ width: botao, height: botao }}
      >
        {enviando ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </button>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        onChange={escolheu}
        className="hidden"
      />

      {erro && (
        <p className="absolute left-0 top-full mt-2 w-48 text-xs text-destructive">{erro}</p>
      )}
    </div>
  );
}
