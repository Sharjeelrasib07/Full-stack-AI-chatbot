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

// The backend Express server's address. Reads from VITE_API_BASE_URL so
// the deployed frontend can point at the deployed backend instead of
// localhost — set that env var in your hosting provider's dashboard when
// you deploy. Falls back to localhost:8000 for local development.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api/chat`;

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

  // `payload` covers every way a message can arrive: plain typed text,
  // text with an image attached, text with a document attached, or a
  // transcribed voice note. It normalizes all of those into:
  //   - content: what actually gets sent to the OpenAI API (a plain string,
  //     or — for images — the multimodal array format the vision model
  //     expects)
  //   - display: what the user's own bubble shows (their typed caption,
  //     which may be empty for an image sent with no text)
  //   - attachment: small metadata (type + filename) so the bubble can show
  //     a thumbnail, a file chip, or a mic badge
  async function handleSend(payload) {
    if (!activeConversation) return;
    const convId = activeConversation.id;

    const text = (payload.text || "").trim();
    let content;
    let display;
    let attachment;

    if (payload.image) {
      const parts = [];
      if (text) parts.push({ type: "text", text });
      parts.push({ type: "image_url", image_url: { url: payload.image.dataUrl } });
      content = parts;
      display = text;
      attachment = { type: "image", name: payload.image.name };
    } else if (payload.document) {
      const docBlock = `[Attached document: ${payload.document.name}]\n${payload.document.text}`;
      content = text ? `${text}\n\n${docBlock}` : docBlock;
      display = text;
      attachment = { type: "document", name: payload.document.name };
    } else {
      content = text;
      display = text;
      if (payload.isVoice) attachment = { type: "voice" };
    }

    if (!content || (typeof content === "string" && !content.trim())) return;

    const userMsg = {
      id: newId(),
      role: "user",
      content,
      display,
      attachment,
      timestamp: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const isFirstMessage = c.messages.length === 0;
        const titleSource =
          display || (attachment?.type === "document" ? attachment.name : attachment?.type === "image" ? "Image" : "New Chat");
        return {
          ...c,
          title: isFirstMessage ? deriveTitle(titleSource) : c.title,
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
      setError(`Could not reach the backend server at ${API_BASE_URL}. Check that it's running and reachable.`);
    } finally {
      setIsSending(false);
      setIsWaitingForFirstToken(false);
    }
  }

  return (
    <div className="app-shell">
      {/* Tap-outside-to-close backdrop for the mobile sidebar. Only ever
          rendered (and clickable) while the sidebar is actually open. */}
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "sidebar-backdrop--visible" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />
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
        apiBaseUrl={API_BASE_URL}
      />
    </div>
  );
}
