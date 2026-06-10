import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <Link to="/" className="flex items-center gap-1.5">
          <img src="/logo-ato.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
          <span className="font-arsenica text-xl leading-none text-accent">ato</span>
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <a href="/#produto" className="hover:text-foreground">
            Produto
          </a>
          <a href="/#como-funciona" className="hover:text-foreground">
            Como funciona
          </a>
          <Link to="/institucional" className="hover:text-foreground">
            Institucional
          </Link>
          <Link to="/precos" className="hover:text-foreground">
            Preços PF
          </Link>
          <Link to="/precos/institucional" className="hover:text-foreground">
            Preços B2B
          </Link>
          <Link to="/entrar" className="hover:text-foreground">
            Entrar
          </Link>
        </nav>
        <p className="text-xs text-ink-soft">© 2026 Ato Regulariza · Feito no Brasil</p>
      </div>
    </footer>
  );
}
