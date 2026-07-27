import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check, Circle, PlayCircle, Lock, LogOut, User as UserIcon,
  BookOpen, Bookmark, GraduationCap, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/cursos/$slug")({
  head: () => ({ meta: [{ title: "Curso — Ato Regulariza" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: CursoPage,
});

type Course  = Tables<"courses">;
type Modulo  = Tables<"course_modules">;
type Aula    = Tables<"course_lessons">;

function CursoPage() {
  const { slug } = Route.useParams();
  const { userId } = Route.useRouteContext();

  const [loading, setLoading]   = useState(true);
  const [denied, setDenied]     = useState(false);
  const [course, setCourse]     = useState<Course | null>(null);
  const [modules, setModules]   = useState<Modulo[]>([]);
  const [lessons, setLessons]   = useState<Record<string, Aula[]>>({}); // moduleId -> aulas
  const [done, setDone]         = useState<Set<string>>(new Set()); // lessonId concluída
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: c } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();
      if (cancelled) return;
      if (!c) { setDenied(true); setLoading(false); return; } // sem curso ou sem acesso (RLS)
      setCourse(c);

      const { data: mods } = await supabase
        .from("course_modules").select("*").eq("course_id", c.id).order("sort");
      if (cancelled || !mods) { setLoading(false); return; }
      setModules(mods);
      setOpenModule(mods[0]?.id ?? null);

      const { data: lessonsData } = await supabase
        .from("course_lessons").select("*")
        .in("module_id", mods.map((m) => m.id)).order("sort");
      if (cancelled) return;
      const byModule: Record<string, Aula[]> = {};
      for (const l of lessonsData ?? []) {
        (byModule[l.module_id] ??= []).push(l);
      }
      setLessons(byModule);

      const allLessonIds = (lessonsData ?? []).map((l) => l.id);
      if (allLessonIds.length) {
        const { data: prog } = await supabase
          .from("lesson_progress").select("lesson_id")
          .eq("user_id", userId).in("lesson_id", allLessonIds);
        if (!cancelled) setDone(new Set((prog ?? []).map((p) => p.lesson_id)));
      }

      const { data: prof } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
      if (!cancelled) setProfileName(prof?.name ?? "");

      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [slug, userId]);

  const totalLessons = Object.values(lessons).reduce((n, arr) => n + arr.length, 0);
  const doneLessons   = Object.values(lessons).flat().filter((l) => done.has(l.id)).length;
  const pct = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const certificateUnlocked = totalLessons > 0 && doneLessons === totalLessons;

  async function toggleLesson(lessonId: string) {
    const isDone = done.has(lessonId);
    setDone((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(lessonId); else next.add(lessonId);
      return next;
    });
    if (isDone) {
      await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
    } else {
      await supabase.from("lesson_progress").insert({ user_id: userId, lesson_id: lessonId });
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/entrar";
  }

  const initials = (profileName || "Aluno").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (denied || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-ink-soft">Você ainda não tem acesso a este curso.</p>
        <Link to="/cursos" className="rounded-full bg-foreground px-5 py-2.5 text-sm text-background hover:opacity-90">
          Ver meus cursos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Sidebar retrátil ── */}
      <aside className="group sticky top-0 h-screen w-16 shrink-0">
        <div className="absolute inset-y-0 left-0 z-20 flex h-full w-16 flex-col overflow-hidden border-r border-border bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]">
          <Link to="/cursos" className="flex items-center gap-2 px-1.5 py-3">
            <img src="/ato-icon.png" alt="Ato Regulariza" className="h-8 w-8 shrink-0 rounded-md object-contain" />
            <div className="overflow-hidden opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="whitespace-nowrap font-arsenica text-lg leading-none text-accent">ato</div>
              <div className="mt-0.5 whitespace-nowrap text-[10px] uppercase tracking-widest text-ink-soft">Cursos</div>
            </div>
          </Link>

          <nav className="mt-4 space-y-1">
            <Link to="/cursos" className="flex items-center gap-3 rounded-xl bg-foreground px-3 py-2.5 text-sm text-background">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Meus cursos</span>
            </Link>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft">
              <Bookmark className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Continuar assistindo</span>
            </div>
            <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${certificateUnlocked ? "text-ink-soft" : "text-ink-soft/50"}`}>
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Certificados</span>
            </div>
          </nav>

          <div className="mt-auto space-y-2">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                {initials}
              </div>
              <span className="whitespace-nowrap text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {profileName || "Aluno"}
              </span>
            </div>
            <button onClick={sair} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-soft hover:bg-surface">
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <main className="mx-auto w-full max-w-3xl px-8 py-10 sm:px-12">
        <div className="text-[11px] uppercase tracking-widest text-ink-soft">Meus cursos</div>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">{course.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {doneLessons} de {totalLessons} aulas concluídas
        </p>

        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-6 space-y-3">
          {modules.map((m) => {
            const mLessons = lessons[m.id] ?? [];
            const mDone = mLessons.filter((l) => done.has(l.id)).length;
            const isOpen = openModule === m.id;
            const allPrevDone = modules
              .filter((prev) => prev.sort < m.sort)
              .every((prev) => (lessons[prev.id] ?? []).every((l) => done.has(l.id)));
            const locked = !allPrevDone && mDone === 0;

            return (
              <div key={m.id} className={`rounded-2xl bg-background p-4 ring-1 ${isOpen ? "ring-accent" : "ring-border"} ${locked ? "opacity-60" : ""}`}>
                <button
                  onClick={() => !locked && setOpenModule(isOpen ? null : m.id)}
                  disabled={locked}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="text-sm font-medium">{m.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-soft">{mDone}/{mLessons.length}</span>
                </button>

                {isOpen && !locked && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                    {mLessons.map((l) => {
                      const isDone = done.has(l.id);
                      return (
                        <button
                          key={l.id}
                          onClick={() => toggleLesson(l.id)}
                          className="flex items-start gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-surface"
                        >
                          {isDone
                            ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                            : l.youtube_id
                              ? <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                              : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft/50" />}
                          <span>
                            <span className={isDone ? "text-foreground" : "text-foreground"}>{l.title}</span>
                            {l.description && (
                              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{l.description}</span>
                            )}
                            {!l.youtube_id && (
                              <span className="mt-0.5 block text-[11px] text-ink-soft/70">Vídeo em breve — clique pra marcar como lida</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Certificado */}
        <div className={`mt-6 flex items-center gap-3.5 rounded-2xl p-4 ${certificateUnlocked ? "bg-foreground" : "bg-foreground"}`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background/10">
            {certificateUnlocked
              ? <GraduationCap className="h-4 w-4 text-background" />
              : <Lock className="h-4 w-4 text-background" />}
          </div>
          <div>
            <div className="text-sm font-medium text-background">
              {certificateUnlocked ? "Certificado de conclusão liberado" : "Certificado de conclusão"}
            </div>
            <div className="text-xs text-background/55">
              {certificateUnlocked
                ? "Você concluiu todos os módulos. Fale com a equipe pra emitir seu certificado."
                : `Libera automaticamente ao concluir os ${modules.length} módulos.`}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
