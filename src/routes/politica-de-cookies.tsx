import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-cookies")({
  head: () => ({
    meta: [
      { title: "Política de Cookies — Ato Regulariza" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PoliticaDeCookiesPage,
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
  table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.92rem}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--slate);font-weight:600}
  .prov{color:var(--accent);font-weight:600}
  a{color:var(--accent)}
  .back{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;color:var(--slate);
    text-decoration:none;margin-bottom:32px}
  .back:hover{color:var(--ink)}
`;

function PoliticaDeCookiesPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main className="wrap">
        <a href="/" className="back">← Voltar ao site</a>
        <h1>Política de Cookies</h1>
        <p className="updated">Versão v1 · última atualização: junho de 2026</p>

        <h2>1. O que são cookies</h2>
        <p>
          Cookies são pequenos arquivos gravados no seu dispositivo durante a navegação. Eles permitem
          que o site funcione corretamente, lembrem preferências e, mediante o seu consentimento, meçam
          o uso das páginas. Tecnologias similares (como pixels e armazenamento local) recebem o mesmo
          tratamento desta Política.
        </p>

        <h2>2. Como você controla os cookies neste site</h2>
        <p>
          Ao acessar o site, um banner de consentimento permite <strong>aceitar</strong>,{" "}
          <strong>recusar</strong> ou <strong>personalizar</strong> por categoria. Cookies estritamente
          necessários funcionam sempre; as demais categorias só são ativadas após o seu consentimento.
          Você pode <strong>rever ou retirar</strong> a sua decisão a qualquer momento pela pílula de
          consentimento fixada no rodapé do site.
        </p>

        <h2>3. Categorias de cookies</h2>
        <table>
          <thead>
            <tr><th>Categoria</th><th>Finalidade</th><th>Consentimento</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Estritamente necessários</strong></td>
              <td>Indispensáveis ao funcionamento e à segurança do site.</td>
              <td>Não exige (sempre ativos)</td>
            </tr>
            <tr>
              <td><strong>Analíticos</strong></td>
              <td>Medem o uso e o desempenho do site, de forma agregada.</td>
              <td>Exige consentimento</td>
            </tr>
            <tr>
              <td><strong>Funcionais</strong></td>
              <td>Habilitam recursos como fontes, chat de atendimento e memorização de preferências.</td>
              <td>Exige consentimento</td>
            </tr>
            <tr>
              <td><strong>Marketing</strong></td>
              <td>Medem campanhas e permitem exibir anúncios mais relevantes.</td>
              <td>Exige consentimento</td>
            </tr>
          </tbody>
        </table>

        <h2>4. Serviços e cookies utilizados</h2>
        <p><span className="prov">Lista provisória</span> — será substituída pela auditoria de cookies do site real quando estiver no ar.</p>
        <table>
          <thead>
            <tr><th>Serviço</th><th>Operador</th><th>Categoria</th><th>Origem</th></tr>
          </thead>
          <tbody>
            <tr><td>Sessão do site</td><td>Gzg Arquitetura LTDA</td><td>Necessário</td><td>BR</td></tr>
            <tr><td>Google Analytics 4 <span className="prov">(prov.)</span></td><td>Google LLC</td><td>Analítico</td><td>EUA</td></tr>
            <tr><td>Hotjar <span className="prov">(prov.)</span></td><td>Hotjar Ltd.</td><td>Analítico</td><td>Malta</td></tr>
            <tr><td>Crisp Chat <span className="prov">(prov.)</span></td><td>Crisp IM SARL</td><td>Funcional</td><td>França</td></tr>
            <tr><td>Google Fonts <span className="prov">(prov.)</span></td><td>Google LLC</td><td>Funcional</td><td>EUA</td></tr>
            <tr><td>Meta Pixel <span className="prov">(prov.)</span></td><td>Meta Platforms, Inc.</td><td>Marketing</td><td>EUA</td></tr>
            <tr><td>Google Ads <span className="prov">(prov.)</span></td><td>Google LLC</td><td>Marketing</td><td>EUA</td></tr>
          </tbody>
        </table>

        <h2>5. Transferência internacional</h2>
        <p>
          Alguns serviços acima (Google, Hotjar, Crisp, Meta) tratam dados em servidores fora do Brasil.
          Quando ocorre transferência internacional, adotam-se as salvaguardas previstas na LGPD.
        </p>

        <h2>6. Base legal</h2>
        <p>
          O tratamento via cookies observa os arts. 7º e 9º da Lei nº 13.709/2018 (LGPD) e o Guia
          Orientativo de Cookies da ANPD (2022). Os cookies não essenciais têm como base o seu{" "}
          <strong>consentimento</strong>, livre e específico, registrado de forma auditável.
        </p>

        <h2>7. Controlador e encarregado</h2>
        <p>
          Gzg Arquitetura LTDA (marca <strong>Ato Regulariza</strong>) · CNPJ 40.420.802/0001-75<br />
          Encarregado (DPO): Gabriel Zanchet Gomes<br />
          Canal do titular: <a href="mailto:contato@atoregulariza.com">contato@atoregulariza.com</a>
        </p>

        <h2>8. Atualizações</h2>
        <p>
          Esta Política pode ser revista. Mudanças relevantes geram nova versão; a versão e a data
          vigentes constam no topo deste documento. Consulte também o{" "}
          <a href="/aviso-de-privacidade">Aviso de Privacidade</a>.
        </p>
      </main>
    </>
  );
}
