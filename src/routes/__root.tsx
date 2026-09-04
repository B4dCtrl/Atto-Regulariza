import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { getRequestHost } from "@/lib/request-host.server";
import { JSON_LD, OG_IMAGE, SITE_URL } from "@/lib/seo";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { ConstructionGate } from "@/components/ConstructionGate";
import { StaffBar } from "@/components/StaffBar";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-serif text-7xl text-foreground">404</p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ink-soft">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm text-background transition-colors hover:bg-foreground/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Ocorreu um erro inesperado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm text-background transition-colors hover:bg-foreground/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2.5 text-sm text-foreground transition-colors hover:bg-surface"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ato Regulariza — Regularização de imóveis, do começo ao registro" },
      {
        name: "description",
        content:
          "Plataforma brasileira que transforma o caos da regularização imobiliária em um fluxo claro. Cliente, profissional e empresa, conectados.",
      },
      { name: "author", content: "Ato Regulariza" },
      { property: "og:site_name", content: "Ato Regulariza" },
      {
        property: "og:title",
        content: "Ato Regulariza — Regularização de imóveis, do começo ao registro",
      },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Ato Regulariza" },
      { name: "twitter:image", content: OG_IMAGE },
      {
        property: "og:description",
        content:
          "Acompanhe cada etapa da regularização do seu imóvel em tempo real. Sem juridiquês, sem planilhas, sem ansiedade.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/ato-icon.png" },
      { rel: "apple-touch-icon", href: "/ato-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
    ],
    scripts: [{ type: "application/ld+json", children: JSON_LD }],
  }),
  // Subdomínio curso.atoregulariza.com.br: a raiz do domínio abre "Meus
  // cursos" em vez do site institucional. Só roda no servidor (SSR).
  beforeLoad: async ({ location }) => {
    if (location.pathname !== "/") return;
    const host = await getRequestHost();
    if (host.startsWith("curso.")) throw redirect({ to: "/cursos" });
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Rotas que exibem dado de cliente. Nenhuma tem link público e todas exigem
 * sessão, mas uma URL que vaze — colada num chat, num print — não pode virar
 * resultado de busca. O robots.txt pede para não rastrear; esta meta garante
 * que, se o buscador chegar mesmo assim, não indexe.
 */
const PRIVADAS = [
  "/dashboard",
  "/admin",
  "/painel-profissional",
  "/perfil",
  "/perfil-profissional",
  "/gestao",
  "/equipe",
  "/analise-cadastro",
  "/redefinir-senha",
  "/entrar",
];

function RootShell({ children }: { children: React.ReactNode }) {
  // Canonical por página: sem ele, /precos e /precos?utm_source=x contam como
  // duas páginas iguais e o Google divide a relevância entre as duas.
  const caminho = useRouterState({ select: (e) => e.location.pathname });
  const canonical = `${SITE_URL}${caminho === "/" ? "" : caminho.replace(/\/$/, "")}`;
  const privada = PRIVADAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));

  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {privada ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : (
          <>
            {/* max-snippet/max-image-preview soltam o tamanho do trecho que o
                Google pode mostrar; sem eles ele corta curto. */}
            <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
            <link rel="canonical" href={canonical} />
            <meta property="og:url" content={canonical} />
          </>
        )}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useInactivityLogout(); // auto-logout após 10 min de inatividade (todas as páginas)

  return (
    <QueryClientProvider client={queryClient}>
      <ConstructionGate>
        <CustomCursor />
        <StaffBar />
        <Outlet />
      </ConstructionGate>
    </QueryClientProvider>
  );
}
