import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Ato Regulariza" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermosDeUsoPage,
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

function TermosDeUsoPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main className="wrap">
        <a href="/" className="back">← Voltar ao site</a>
        <h1>Termos de Uso</h1>
        <p className="updated">Última atualização: junho de 2026</p>

        <p>
          Estes Termos regem o uso do site e da plataforma <strong>Ato Regulariza</strong>, operados por{" "}
          <strong>Gzg Arquitetura LTDA</strong> (CNPJ 40.420.802/0001-75). Ao navegar, você concorda com
          as condições abaixo.
        </p>

        <h2>1. Objeto</h2>
        <p>
          Este site apresenta a <strong>Ato Regulariza</strong>, plataforma de regularização imobiliária,
          e seus serviços. Parte das funcionalidades pode estar em fase de construção ou pré-lançamento.
          O conteúdo institucional tem caráter informativo; a contratação dos serviços de regularização
          ocorre por instrumento próprio.
        </p>

        <h2>2. O conteúdo não constitui aconselhamento jurídico ou técnico</h2>
        <p>
          As informações deste site têm caráter geral e não substituem a análise individualizada de um
          caso concreto de regularização. <strong>O acesso ou o contato pelo site não cria, por si só,
          vínculo contratual</strong>, que se estabelece apenas mediante contratação específica e formal.
          Não envie informações sigilosas ou sensíveis por canais não seguros antes da formalização do
          atendimento.
        </p>

        <h2>3. Propriedade intelectual</h2>
        <p>
          A marca, o logotipo, os textos, o layout e os demais elementos do site são protegidos e não
          podem ser reproduzidos, no todo ou em parte, sem autorização prévia e por escrito.
        </p>

        <h2>4. Uso adequado</h2>
        <p>
          Você se compromete a usar o site de forma lícita, sem tentar comprometer sua segurança, sua
          disponibilidade ou a integridade dos dados, e sem praticar atos que violem direitos de
          terceiros ou a legislação aplicável.
        </p>

        <h2>5. Links e serviços de terceiros</h2>
        <p>
          O site pode conter links para serviços de terceiros (por exemplo, WhatsApp). A Gzg Arquitetura
          não se responsabiliza pelo conteúdo, pelas práticas ou pelas políticas desses serviços, que se
          submetem a seus próprios termos.
        </p>

        <h2>6. Privacidade e cookies</h2>
        <p>
          O tratamento de dados pessoais e o uso de cookies seguem o{" "}
          <a href="/aviso-de-privacidade">Aviso de Privacidade</a> e a{" "}
          <a href="/politica-de-cookies">Política de Cookies</a>, que integram estes Termos.
        </p>

        <h2>7. Limitação de responsabilidade</h2>
        <p>
          A Gzg Arquitetura empenha-se para manter as informações corretas e o site disponível, mas não
          garante ausência de interrupções ou erros. O conteúdo é fornecido "no estado em que se
          encontra", com finalidade informativa.
        </p>

        <h2>8. Alterações</h2>
        <p>
          Estes Termos podem ser atualizados a qualquer tempo; a data vigente consta no topo do
          documento. O uso continuado do site após alterações implica concordância com a versão vigente.
        </p>

        <h2>9. Legislação aplicável e foro</h2>
        <p>
          Aplica-se a legislação brasileira. Fica eleito o foro do domicílio do controlador para dirimir
          questões decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.
        </p>

        <h2>10. Contato</h2>
        <p>
          Gzg Arquitetura LTDA (marca Ato Regulariza) · CNPJ 40.420.802/0001-75<br />
          <a href="mailto:contato@atoregulariza.com">contato@atoregulariza.com</a> · WhatsApp +55 67 99851-3179
        </p>
      </main>
    </>
  );
}
