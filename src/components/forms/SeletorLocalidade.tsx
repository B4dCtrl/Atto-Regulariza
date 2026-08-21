import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

/**
 * Estado e cidade, nessa ordem.
 *
 * A cidade define qual prefeitura e qual cartório cuidam do processo — é campo
 * operacional, não decorativo. Em texto livre chegavam "Curitba", "curitiba" e
 * "Curitiba-PR" como se fossem lugares diferentes, e alguém tinha que
 * normalizar isso à mão depois.
 *
 * A lista de municípios do estado escolhido é carregada sob demanda, do próprio
 * domínio. São 5.571 municípios no total, mas o usuário baixa só o estado dele:
 * 6 KB no Paraná, 12,9 KB em Minas, que é o maior. Consultar o IBGE ao vivo
 * custaria abrir a CSP para um terceiro e deixaria um campo obrigatório
 * dependendo de uma API fora do nosso controle.
 */

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

// Vite transforma cada JSON num chunk próprio; nada disso entra no bundle
// inicial. A chave do mapa é o caminho literal, daí o template abaixo.
const ARQUIVOS = import.meta.glob<{ default: string[] }>("../../data/municipios/*.json");

/** "São josé" e "sao jose" precisam achar "São José". */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function SeletorLocalidade({
  uf,
  cidade,
  onChange,
  obrigatorio = false,
  className = "",
}: {
  uf: string;
  cidade: string;
  onChange: (valores: { uf: string; cidade: string }) => void;
  obrigatorio?: boolean;
  /** Classe do input/select, para o componente herdar o estilo de cada tela. */
  className?: string;
}) {
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destacado, setDestacado] = useState(0);
  const caixaRef = useRef<HTMLDivElement>(null);
  const idUf = useId();
  const idCidade = useId();

  useEffect(() => {
    if (!uf) {
      setMunicipios([]);
      return;
    }
    const carregador = ARQUIVOS[`../../data/municipios/${uf}.json`];
    if (!carregador) {
      setMunicipios([]);
      return;
    }
    let cancelado = false;
    setCarregando(true);
    carregador()
      .then((m) => {
        if (!cancelado) setMunicipios(m.default);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [uf]);

  // Fecha ao clicar fora, senão a lista fica pendurada sobre o resto do form.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return municipios;
    // Quem começa com o termo vem antes: digitando "sao", "São Paulo" deve
    // aparecer acima de "Bom Jesus de São Paulo".
    const comeca: string[] = [];
    const contem: string[] = [];
    for (const m of municipios) {
      const n = normalizar(m);
      if (n.startsWith(termo)) comeca.push(m);
      else if (n.includes(termo)) contem.push(m);
    }
    return [...comeca, ...contem];
  }, [municipios, busca]);

  function escolher(nome: string) {
    onChange({ uf, cidade: nome });
    setBusca("");
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setDestacado((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestacado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Só confirma o que está na lista: cidade digitada por extenso e não
      // encontrada não vira valor válido.
      if (aberto && filtradas[destacado]) {
        e.preventDefault();
        escolher(filtradas[destacado]);
      }
    } else if (e.key === "Escape") {
      setAberto(false);
      setBusca("");
    }
  }

  const estiloBase =
    className ||
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/30";

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={idUf} className="mb-1.5 block text-sm font-medium">
          Estado {obrigatorio && <span className="text-accent">*</span>}
        </label>
        <select
          id={idUf}
          value={uf}
          onChange={(e) => {
            // Trocar de estado invalida a cidade: ela pertencia à lista antiga.
            onChange({ uf: e.target.value, cidade: "" });
            setBusca("");
          }}
          className={estiloBase}
        >
          <option value="">Selecione…</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div ref={caixaRef} className="relative">
        <label htmlFor={idCidade} className="mb-1.5 block text-sm font-medium">
          Cidade {obrigatorio && <span className="text-accent">*</span>}
        </label>

        <div className="relative">
          <input
            id={idCidade}
            type="text"
            role="combobox"
            aria-expanded={aberto}
            aria-controls={`${idCidade}-lista`}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={!uf || carregando}
            value={aberto ? busca : cidade}
            placeholder={
              !uf ? "Escolha o estado primeiro" : carregando ? "Carregando…" : "Digite para buscar"
            }
            onFocus={() => {
              if (uf) {
                setAberto(true);
                setBusca("");
                setDestacado(0);
              }
            }}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
              setDestacado(0);
            }}
            onKeyDown={aoTeclar}
            className={`${estiloBase} pr-9 disabled:opacity-50`}
          />
          {carregando ? (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-soft" />
          ) : (
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          )}
        </div>

        {aberto && !carregando && (
          <ul
            id={`${idCidade}-lista`}
            role="listbox"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-background py-1 shadow-xl"
          >
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-soft">
                Nenhuma cidade encontrada em {uf}.
              </li>
            ) : (
              filtradas.slice(0, 100).map((m, i) => (
                <li key={m}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={m === cidade}
                    onMouseEnter={() => setDestacado(i)}
                    onClick={() => escolher(m)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      i === destacado ? "bg-surface" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{m}</span>
                    {m === cidade && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
