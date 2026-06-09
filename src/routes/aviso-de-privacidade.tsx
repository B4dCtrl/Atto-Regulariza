import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/aviso-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidade — Ato Regulariza" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: AvisoDePrivacidadePage,
});

const css = `
  :root{--ink:#0f1626;--slate:#50606f;--line:#e4e8f0;--accent:#2563eb}
  *{box-sizing:border-box}
  body{margin:0;background:#f7f9fc;color:var(--ink);line-height:1.65;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:760px;margin:0 auto;padding:48px 24px 96px}
  h1{font-size:2rem;margin:0 0 .4rem}
  .updated{color:var(--slate);font-size:.9rem;margin:0 0 2rem}
  h2{font-size:1.25rem;margin:2.2rem 0 .6rem;padding-top:1.3rem;border-top:1px solid var(--line)}
  p,li{color:#2b3340}
  a{color:var(--accent)}
  ul{padding-left:1.2rem}
  li{margin-bottom:.35rem}
  .back{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;color:var(--slate);
    text-decoration:none;margin-bottom:32px}
  .back:hover{color:var(--ink)}
`;

function AvisoDePrivacidadePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main className="wrap">
        <a href="/" className="back">← Voltar ao site</a>
        <h1>Aviso de Privacidade</h1>
        <p className="updated">Última atualização: junho de 2026</p>

        <p>
          Este Aviso descreve, em conformidade com o art. 9º da Lei nº 13.709/2018 (LGPD), como a{" "}
          <strong>Gzg Arquitetura LTDA</strong>, por meio da plataforma e do site{" "}
          <strong>Ato Regulariza</strong>, trata dados pessoais coletados neste site.
        </p>

        <h2>1. Controlador</h2>
        <p>
          Gzg Arquitetura LTDA (marca <strong>Ato Regulariza</strong>)<br />
          CNPJ 40.420.802/0001-75
        </p>

        <h2>2. Encarregado (DPO)</h2>
        <p>
          Encarregado pelo tratamento de dados pessoais: <strong>Gabriel Zanchet Gomes</strong>.<br />
          Canal para assuntos de dados pessoais e exercício de direitos:{" "}
          <a href="mailto:contato@atoregulariza.com">contato@atoregulariza.com</a>.
        </p>

        <h2>3. Dados tratados</h2>
        <ul>
          <li>
            <strong>Dados de contato fornecidos por você</strong> — nome, telefone, e-mail e conteúdo
            da mensagem, quando nos procura por formulário, e-mail ou WhatsApp, inclusive para avaliação
            de um caso de regularização.
          </li>
          <li>
            <strong>Dados de navegação</strong> — coletados por cookies e tecnologias similares,
            conforme a <a href="/politica-de-cookies">Política de Cookies</a> e mediante o seu
            consentimento para as categorias não essenciais.
          </li>
          <li>
            <strong>Registros técnicos</strong> — dados como endereço IP podem ser registrados pela
            infraestrutura de hospedagem, por segurança e estabilidade.
          </li>
        </ul>

        <h2>4. Finalidades e bases legais</h2>
        <ul>
          <li>Responder a contatos e avaliar solicitações de regularização — procedimentos preliminares a contrato e legítimo interesse (art. 7º, V e IX).</li>
          <li>Prestar os serviços de regularização contratados — execução de contrato (art. 7º, V).</li>
          <li>Cumprir obrigações legais e regulatórias aplicáveis — obrigação legal (art. 7º, II).</li>
          <li>Medição de audiência e recursos do site — <strong>consentimento</strong> (art. 7º, I e art. 9º).</li>
          <li>Marketing e mensuração de campanhas (ex.: Meta Pixel, Google Ads) — <strong>consentimento</strong> (art. 7º, I e art. 9º).</li>
        </ul>

        <h2>5. Compartilhamento</h2>
        <p>
          Não comercializamos dados pessoais. Compartilhamos apenas com operadores necessários (por
          exemplo, hospedagem, atendimento e serviços de análise consentidos), com parceiros estritamente
          necessários à execução da regularização, e com autoridades quando exigido por lei ou para o
          exercício regular de direitos.
        </p>

        <h2>6. Transferência internacional</h2>
        <p>
          A hospedagem e alguns serviços podem tratar dados fora do Brasil. Nesses casos, adotam-se as
          salvaguardas previstas na LGPD.
        </p>

        <h2>7. Retenção e descarte</h2>
        <p>
          Os dados são mantidos pelo tempo necessário às finalidades e ao cumprimento de obrigações
          legais e regulatórias. Encerradas as finalidades, são eliminados ou anonimizados, ressalvadas
          as hipóteses de guarda obrigatória.
        </p>

        <h2>8. Direitos do titular (art. 18 da LGPD)</h2>
        <ul>
          <li>confirmação da existência de tratamento e acesso aos dados;</li>
          <li>correção, anonimização, bloqueio ou eliminação;</li>
          <li>portabilidade e informação sobre compartilhamento;</li>
          <li>revogação do consentimento, quando for a base aplicável.</li>
        </ul>
        <p>Exercício pelo canal <a href="mailto:contato@atoregulariza.com">contato@atoregulariza.com</a>.</p>

        <h2>9. Autoridade Nacional (ANPD)</h2>
        <p>Você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</p>

        <h2>10. Atualizações</h2>
        <p>Este Aviso pode ser atualizado; a data vigente consta no topo do documento.</p>
      </main>
    </>
  );
}
