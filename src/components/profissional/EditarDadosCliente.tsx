import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Os campos do processo que descrevem o cliente e o imóvel. */
type Dados = {
  client_name: string;
  client_email: string;
  client_phone: string;
  client_cpf: string;
  city: string;
  state: string;
  tipo_imovel: string;
  situacao: string;
  objetivo: string;
};

const CAMPOS: { k: keyof Dados; rotulo: string; largo?: boolean }[] = [
  { k: "client_name", rotulo: "Nome", largo: true },
  { k: "client_email", rotulo: "E-mail", largo: true },
  { k: "client_phone", rotulo: "Telefone" },
  { k: "client_cpf", rotulo: "CPF" },
  { k: "city", rotulo: "Cidade" },
  { k: "state", rotulo: "UF" },
  { k: "tipo_imovel", rotulo: "Tipo do imóvel", largo: true },
  { k: "situacao", rotulo: "Situação", largo: true },
  { k: "objetivo", rotulo: "Objetivo", largo: true },
];

const VAZIO: Dados = {
  client_name: "",
  client_email: "",
  client_phone: "",
  client_cpf: "",
  city: "",
  state: "",
  tipo_imovel: "",
  situacao: "",
  objetivo: "",
};

/**
 * Corrigir o que o cliente informou no cadastro — telefone que faltou, cidade
 * digitada errado, CPF que chegou depois.
 *
 * Grava direto em `properties`: a política de UPDATE já deixa o profissional
 * do caso e o admin, e mais ninguém. É dado do processo; a conta do cliente
 * (login, e-mail de acesso) não muda por aqui.
 */
export function EditarDadosCliente({
  propertyId,
  onSalvo,
}: {
  propertyId: string;
  onSalvo?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    supabase
      .from("properties")
      .select(
        "client_name, client_email, client_phone, client_cpf, city, state, tipo_imovel, situacao, objetivo",
      )
      .eq("id", propertyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error || !data) setErro("Não foi possível carregar os dados.");
        else {
          const lido = { ...VAZIO };
          for (const { k } of CAMPOS) lido[k] = data[k] ?? "";
          setDados(lido);
        }
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto, propertyId]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    // Campo apagado vira nulo, não texto vazio: "—" na tela, e nada de
    // "Campo Magro/" com barra órfã.
    const patch = Object.fromEntries(CAMPOS.map(({ k }) => [k, dados[k].trim() || null])) as Record<
      keyof Dados,
      string | null
    >;
    patch.state = patch.state?.toUpperCase() ?? null;

    const { error } = await supabase.from("properties").update(patch).eq("id", propertyId);
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar: ${error.message}`);
      return;
    }
    setAberto(false);
    onSalvo?.();
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-[11px] text-ink-soft transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
        Editar dados do cliente
      </button>
    );
  }

  const inp =
    "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-foreground/30";

  return (
    <div className="rounded-xl bg-background p-3 ring-1 ring-border">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-ink-soft">
        Dados do cliente
      </div>
      {carregando ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {CAMPOS.map(({ k, rotulo, largo }) => (
            <label key={k} className={largo ? "col-span-2" : ""}>
              <span className="mb-0.5 block text-[10px] text-ink-soft">{rotulo}</span>
              <input
                value={dados[k]}
                maxLength={k === "state" ? 2 : 200}
                onChange={(e) => setDados((d) => ({ ...d, [k]: e.target.value }))}
                className={inp}
              />
            </label>
          ))}
        </div>
      )}
      {erro && <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="flex-1 rounded-lg border border-border py-1.5 text-[11px] text-ink-soft hover:bg-surface"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={salvando || carregando}
          onClick={salvar}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-foreground py-1.5 text-[11px] text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
