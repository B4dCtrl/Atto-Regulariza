import {
  descreverRespostas,
  nomeDoProduto,
  type Cor,
  type Produto,
  type Respostas,
} from "@/lib/triagem";

/**
 * O que a triagem descobriu, para a equipe decidir.
 *
 * Antes o painel do lead mostrava apenas "Situação do imóvel: —", e a etapa
 * Triagem não tinha o que analisar: só restava atribuir alguém no escuro. Tudo
 * isto já estava gravado no banco — faltava mostrar.
 *
 * A cor vem primeiro porque é ela que decide a ordem de atendimento, e o
 * motivo ao lado dela porque cor sem explicação vira superstição.
 */

const CLASSE_COR: Record<Cor, string> = {
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amarelo: "bg-amber-50 text-amber-900 ring-amber-200",
  vermelho: "bg-red-50 text-red-800 ring-red-200",
};

const ROTULO_COR: Record<Cor, string> = {
  verde: "Pronto para orçamento",
  amarelo: "Precisa de análise",
  vermelho: "Questão de titularidade",
};

export type DadosTriagem = {
  cor: Cor | null;
  motivo: string | null;
  produto: Produto;
  respostas: Partial<Respostas> | null;
  codigo: string | null;
};

export function DetalheTriagem({ dados }: { dados: DadosTriagem }) {
  // Lead antigo, ou criado à mão, não passou por triagem. Some em vez de
  // mostrar um bloco vazio.
  if (!dados.cor && !dados.respostas) return null;

  const respostas = dados.respostas ? descreverRespostas(dados.respostas) : [];
  const produto = nomeDoProduto(dados.produto);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">Triagem</div>
        {dados.codigo && (
          <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
            {dados.codigo}
          </span>
        )}
      </div>

      {dados.cor && (
        <div className={`rounded-xl p-2.5 text-xs ring-1 ${CLASSE_COR[dados.cor]}`}>
          <div className="font-medium">{ROTULO_COR[dados.cor]}</div>
          {dados.motivo && <p className="mt-0.5 leading-relaxed opacity-90">{dados.motivo}</p>}
        </div>
      )}

      {produto && (
        <div className="flex gap-2 text-xs">
          <span className="w-20 shrink-0 text-ink-soft">Serviço</span>
          <span>{produto}</span>
        </div>
      )}

      {respostas.length > 0 && (
        <div className="space-y-1.5 rounded-2xl bg-surface p-3 text-xs">
          {respostas.map((r) => (
            <div key={r.pergunta}>
              <div className="text-ink-soft">{r.pergunta}</div>
              <div className="mt-0.5 leading-relaxed">{r.resposta}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
