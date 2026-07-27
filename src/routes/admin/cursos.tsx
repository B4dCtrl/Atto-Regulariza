import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen, ChevronDown, ChevronRight, Plus, Trash2,
  Youtube, Check, Loader2, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/cursos")({
  head: () => ({ meta: [{ title: "Cursos — Gestão Regulariza" }] }),
  component: AdminCursosPage,
});

type Course = Tables<"courses">;
type Modulo = Tables<"course_modules">;
type Aula   = Tables<"course_lessons">;

/** Aceita link completo do YouTube (várias formas) ou só o ID, devolve o ID. */
function extractYoutubeId(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return s; // já é o ID puro
}

function AdminCursosPage() {
  const [courses, setCourses]   = useState<Course[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string | null>(null); // course id
  const [modules, setModules]   = useState<Modulo[]>([]);
  const [lessons, setLessons]   = useState<Record<string, Aula[]>>({});
  const [openMods, setOpenMods] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft]       = useState<Record<string, string>>({}); // lessonId -> valor do input

  async function loadCourses() {
    const { data } = await supabase.from("courses").select("*").order("created_at");
    setCourses(data ?? []);
    setLoading(false);
    if (data && data.length && !selected) setSelected(data[0].id);
  }

  async function loadCourseContent(courseId: string) {
    const { data: mods } = await supabase.from("course_modules").select("*").eq("course_id", courseId).order("sort");
    setModules(mods ?? []);
    setOpenMods(new Set((mods ?? []).map((m) => m.id))); // abre tudo por padrão
    if (!mods?.length) { setLessons({}); return; }
    const { data: less } = await supabase.from("course_lessons").select("*").in("module_id", mods.map((m) => m.id)).order("sort");
    const byModule: Record<string, Aula[]> = {};
    for (const l of less ?? []) (byModule[l.module_id] ??= []).push(l);
    setLessons(byModule);
    const d: Record<string, string> = {};
    for (const l of less ?? []) d[l.id] = l.youtube_id ?? "";
    setDraft(d);
  }

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { if (selected) loadCourseContent(selected); }, [selected]);

  async function saveVideo(lessonId: string) {
    const id = extractYoutubeId(draft[lessonId] ?? "");
    setSavingId(lessonId);
    await supabase.from("course_lessons").update({ youtube_id: id || null }).eq("id", lessonId);
    setLessons((prev) => {
      const next = { ...prev };
      for (const modId in next) {
        next[modId] = next[modId].map((l) => (l.id === lessonId ? { ...l, youtube_id: id || null } : l));
      }
      return next;
    });
    setDraft((prev) => ({ ...prev, [lessonId]: id }));
    setSavingId(null);
  }

  async function addLesson(moduleId: string) {
    const title = prompt("Título da aula:");
    if (!title?.trim()) return;
    const count = (lessons[moduleId] ?? []).length;
    const { data } = await supabase.from("course_lessons")
      .insert({ module_id: moduleId, title: title.trim(), sort: count + 1 })
      .select("*").single();
    if (data) {
      setLessons((prev) => ({ ...prev, [moduleId]: [...(prev[moduleId] ?? []), data] }));
      setDraft((prev) => ({ ...prev, [data.id]: "" }));
    }
  }

  async function removeLesson(moduleId: string, lessonId: string) {
    if (!confirm("Remover esta aula?")) return;
    await supabase.from("course_lessons").delete().eq("id", lessonId);
    setLessons((prev) => ({ ...prev, [moduleId]: prev[moduleId].filter((l) => l.id !== lessonId) }));
  }

  async function addModule() {
    if (!selected) return;
    const title = prompt("Título do módulo:");
    if (!title?.trim()) return;
    const { data } = await supabase.from("course_modules")
      .insert({ course_id: selected, title: title.trim(), sort: modules.length + 1 })
      .select("*").single();
    if (data) {
      setModules((prev) => [...prev, data]);
      setOpenMods((prev) => new Set(prev).add(data.id));
    }
  }

  async function addCourse() {
    const title = prompt("Título do novo curso:");
    if (!title?.trim()) return;
    const slug = title.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data, error } = await supabase.from("courses")
      .insert({ title: title.trim(), slug, published: false })
      .select("*").single();
    if (error) { alert(`Erro: ${error.message}`); return; }
    if (data) { setCourses((prev) => [...prev, data]); setSelected(data.id); }
  }

  function toggleMod(id: string) {
    setOpenMods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const totalLessons = Object.values(lessons).flat().length;
  const withVideo = Object.values(lessons).flat().filter((l) => l.youtube_id).length;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Cursos</div>
          <h1 className="font-serif text-3xl tracking-tight">Indexar vídeos</h1>
          {selected && (
            <p className="mt-1 text-sm text-ink-soft">{withVideo} de {totalLessons} aulas já com vídeo</p>
          )}
        </div>
        <button onClick={addCourse} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 transition-colors">
          <Plus className="h-4 w-4" /> Novo curso
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-soft" /></div>
      ) : courses.length === 0 ? (
        <div className="rounded-3xl bg-background ring-1 ring-border p-16 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-ink-soft" />
          <p className="mt-3 text-sm text-ink-soft">Nenhum curso cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Lista de cursos */}
          <div className="space-y-1.5">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selected === c.id ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{c.title}</span>
                {!c.published && <span className="ml-auto shrink-0 text-[10px] opacity-60">rascunho</span>}
              </button>
            ))}
          </div>

          {/* Módulos e aulas do curso selecionado */}
          <div>
            {selected && (
              <>
                <div className="mb-3 flex items-center justify-end">
                  <button onClick={addModule} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink-soft hover:border-foreground/30 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Novo módulo
                  </button>
                </div>

                <div className="space-y-3">
                  {modules.map((m) => {
                    const mLessons = lessons[m.id] ?? [];
                    const isOpen = openMods.has(m.id);
                    return (
                      <div key={m.id} className="rounded-2xl bg-background ring-1 ring-border overflow-hidden">
                        <button onClick={() => toggleMod(m.id)} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface/50 transition-colors">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-ink-soft" /> : <ChevronRight className="h-4 w-4 text-ink-soft" />}
                          <span className="text-sm font-medium">{m.title}</span>
                          <span className="ml-auto text-xs text-ink-soft">{mLessons.length} aula{mLessons.length !== 1 ? "s" : ""}</span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border p-4 space-y-3">
                            {mLessons.map((l) => (
                              <div key={l.id} className="rounded-xl bg-surface/50 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium">{l.title}</div>
                                    {l.description && <div className="mt-0.5 text-xs text-ink-soft line-clamp-2">{l.description}</div>}
                                  </div>
                                  <button onClick={() => removeLesson(m.id, l.id)} className="shrink-0 grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-border transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <Youtube className="h-4 w-4 shrink-0 text-ink-soft" />
                                  <input
                                    value={draft[l.id] ?? ""}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                    placeholder="Cole o link do YouTube ou o ID do vídeo…"
                                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground/30"
                                  />
                                  <button
                                    onClick={() => saveVideo(l.id)}
                                    disabled={savingId === l.id}
                                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                                  >
                                    {savingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : l.youtube_id ? <Check className="h-3 w-3" /> : "Salvar"}
                                  </button>
                                  {l.youtube_id && (
                                    <a href={`https://youtube.com/watch?v=${l.youtube_id}`} target="_blank" rel="noreferrer" className="shrink-0 grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-border transition-colors" title="Abrir no YouTube">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                            <button onClick={() => addLesson(m.id)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink-soft hover:border-foreground/30 transition-colors">
                              <Plus className="h-3.5 w-3.5" /> Nova aula
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
