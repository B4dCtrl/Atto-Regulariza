import { useRef, useState, type FormEvent } from "react";
import { Send, Bot, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;

const suggestions = [
  "Quais documentos para usucapião urbano?",
  "Diferença entre habite-se e averbação",
  "Prazo médio na prefeitura de SP",
];

export function ChatbotPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Oi! Sou o assistente Regulariza. Posso explicar etapas, documentos exigidos e prazos. Pergunte algo.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stream = async (next: Msg[]) => {
    // Envia o token da SESSÃO do usuário — não a chave anônima. A função exige admin.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada. Entre novamente.");

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages: next }),
    });
    if (resp.status === 401) throw new Error("Sessão expirada. Entre novamente.");
    if (resp.status === 403) throw new Error("Este assistente é restrito à equipe.");
    if (resp.status === 429) throw new Error("Muitas requisições. Tente em instantes.");
    if (resp.status === 402)
      throw new Error("Sem créditos de IA. Adicione saldo em Workspace → Usage.");
    if (!resp.ok || !resp.body) throw new Error("Falha ao iniciar chat.");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let acc = "";
    let done = false;

    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") {
          done = true;
          break;
        }
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            acc += delta;
            setMessages((m) => {
              const out = [...m];
              out[out.length - 1] = { role: "assistant", content: acc };
              return out;
            });
            queueMicrotask(() => scrollRef.current?.scrollTo({ top: 9e9 }));
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      await stream(next);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: e instanceof Error ? e.message : "Erro." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="rounded-2xl bg-background ring-1 ring-border flex flex-col h-[460px]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium leading-none">Assistente Regulariza</div>
          <div className="text-[11px] text-ink-soft mt-0.5 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> online · responde em segundos
          </div>
        </div>
        <Sparkles className="h-3.5 w-3.5 text-accent" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === "user"
                ? "ml-auto rounded-br-md bg-accent text-accent-foreground"
                : "rounded-bl-md bg-surface text-foreground"
            }`}
          >
            {m.content || (loading && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-ink-soft hover:bg-foreground hover:text-background transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="border-t border-border p-2 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre um processo, prazo, documento…"
          className="flex-1 rounded-full bg-surface px-4 py-2 text-sm outline-none placeholder:text-ink-soft/60"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
