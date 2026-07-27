import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/cursos/")({
  head: () => ({ meta: [{ title: "Meus cursos — Ato Regulariza" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: MeusCursosPage,
});

type Course = Tables<"courses">;

function MeusCursosPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    supabase.from("courses").select("*").order("created_at").then(({ data }) => {
      setCourses(data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-8 py-4">
        <img src="/ato-icon.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
        <span className="font-arsenica text-lg leading-none text-accent">ato</span>
        <span className="text-xs uppercase tracking-widest text-ink-soft">Cursos</span>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        <h1 className="font-serif text-3xl tracking-tight">Meus cursos</h1>

        {loading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink-soft" /></div>
        ) : courses.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-surface/50 p-10 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-ink-soft" />
            <p className="mt-3 text-sm text-ink-soft">Você ainda não tem nenhum curso liberado.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                to="/cursos/$slug"
                params={{ slug: c.slug }}
                className="rounded-2xl bg-background p-5 ring-1 ring-border transition-shadow hover:shadow-md hover:ring-foreground/20"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="mt-3 font-serif text-xl leading-snug">{c.title}</h2>
                {c.description && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{c.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
