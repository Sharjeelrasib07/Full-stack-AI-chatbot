import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import {
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
  loadTheme,
  saveTheme,
  makeConversation,
  deriveTitle,
  newId,
} from "./lib/storage";
import "./App.css";

// The backend Express server's address. In production this would move to
// an environment variable, but a constant keeps the local demo simple.
const API_URL = "http://localhost:8000/api/chat";

export default function App() {
  const [conversations, setConversations] = useState(() => {
    const loaded = loadConversations();
    return loaded.length > 0 ? loaded : [makeConversation()];
  });

  const [activeId, setActiveId] = useState(() => {
    const stored = loadActiveId();
    if (stored && conversations.some((c) => c.id === stored)) return stored;
    return conversations[0]?.id ?? null;
  });

  const [theme, setTheme] = useState(() => loadTheme());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [error, setError] = useState(null);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? conversations[0];

  // Persist to localStorage whenever the relevant piece of state changes.
  useEffect(() => saveConversations(conversations), [conversations]);
  useEffect(() => saveActiveId(activeId), [activeId]);
  useEffect(() => {
    saveTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function handleNewChat() {
    const conv = makeConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setError(null);
    setIsSidebarOpen(false);
  }

  function handleSelect(id) {
    setActiveId(id);
    setError(null);
    setIsSidebarOpen(false);
  }

  function handleDelete(id) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        setActiveId(next[0].id);
      }
      return next;
    });
  }

  function handleToggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  async function handleSend(text) {
    if (!activeConversation) return;
    const convId = activeConversation.id;
    const userMsg = { id: newId(), role: "user", content: text, timestamp: Date.now() };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const isFirstMessage = c.messages.length === 0;
        return {
          ...c,
          title: isFirstMessage ? deriveTitle(text) : c.title,
          messages: [...c.messages, userMsg],
        };
      })
    );

    setError(null);
    setIsSending(true);
    setIsWaitingForFirstToken(true);

    // Built explicitly (not read back from state) since the setConversations
    // call above is async — this always reflects exactly what we just sent.
    const payloadMessages = [...activeConversation.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantId = newId();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
        return;
      }

      // Add an empty assistant bubble that fills in as tokens stream in.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
                ],
              }
            : c
        )
      );

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assembled = "";
      let firstTokenArrived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        if (!chunkText) continue;

        if (!firstTokenArrived) {
          firstTokenArrived = true;
          setIsWaitingForFirstToken(false);
        }

        assembled += chunkText;
        const snapshot = assembled;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: snapshot } : m
                  ),
                }
              : c
          )
        );
      }

      if (!assembled) {
        setError("The AI didn't return a reply. Please try again.");
      }
    } catch (err) {
      setError("Could not reach the backend server. Is it running on port 8000?");
    } finally {
      setIsSending(false);
      setIsWaitingForFirstToken(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeConversation?.id}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isOpen={isSidebarOpen}
      />
      <ChatWindow
        conversation={activeConversation}
        isWaitingForFirstToken={isWaitingForFirstToken}
        error={error}
        onSend={handleSend}
        isSending={isSending}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
      />
    </div>
  );
}
