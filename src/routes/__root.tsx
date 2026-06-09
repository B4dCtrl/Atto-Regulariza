import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { ConstructionGate } from "@/components/ConstructionGate";
import { StaffBar } from "@/components/StaffBar";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-serif text-7xl text-foreground">404</p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Página não encontrada
        </h1>
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
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
      { title: "Regulariza — Regularização imobiliária, finalmente clara" },
      {
        name: "description",
        content:
          "Plataforma brasileira que transforma o caos da regularização imobiliária em um fluxo claro. Cliente, profissional e empresa, conectados.",
      },
      { name: "author", content: "Regulariza" },
      { property: "og:title", content: "Regulariza — Regularização imobiliária, finalmente clara" },
      {
        property: "og:description",
        content:
          "Acompanhe cada etapa da regularização do seu imóvel em tempo real. Sem juridiquês, sem planilhas, sem ansiedade.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/logo-ato.png" },
      { rel: "apple-touch-icon", href: "/logo-ato.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        {/* Allmo Consent — gerenciador LGPD de cookies */}
        <script
          src="https://lwlniuqzicncramyyvut.supabase.co/storage/v1/object/public/cdn/consent/v1.js"
          defer
          data-allmo-consent=""
          data-client="ato-regulariza"
          data-tone="tecnico"
          data-categories="analytics,functional,marketing"
          data-cookies-policy-url="/politica-de-cookies"
          data-privacy-policy-url="/aviso-de-privacidade"
          data-terms-url="/termos-de-uso"
          data-policy-version="v1"
          data-endpoint="https://lwlniuqzicncramyyvut.supabase.co/functions/v1/consent"
          data-anon-key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3bG5pdXF6aWNuY3JhbXl5dnV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjk3OTIsImV4cCI6MjA5MjkwNTc5Mn0.7m4Q_fL24M8BgTQpTVQvlf6IZky4s5o8w4ZFEMLpjfg"
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

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
