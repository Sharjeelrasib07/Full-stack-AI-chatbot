import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SettingsPanel from "./components/SettingsPanel";
import {
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
  loadTheme,
  saveTheme,
  loadSettings,
  saveSettings,
  compileKnowledgeBase,
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
  const [settings, setSettings] = useState(() => loadSettings());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? conversations[0];

  // Persist to localStorage whenever the relevant piece of state changes.
  useEffect(() => saveConversations(conversations), [conversations]);
  useEffect(() => saveActiveId(activeId), [activeId]);
  useEffect(() => {
    saveTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => saveSettings(settings), [settings]);

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

  function handleRename(id, newTitle) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed.slice(0, 60), titleLocked: true } : c))
    );
  }

  function handleToggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function handleReaction(messageId, reaction) {
    if (!activeConversation) return;
    const convId = activeConversation.id;
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, reaction: m.reaction === reaction ? null : reaction } : m
              ),
            }
      )
    );
  }

  // Shared by a fresh send, a regenerate, and an edit-and-resend — all three
  // end the same way: POST the given message history and stream the reply
  // into a new assistant bubble on the given conversation.
  async function streamAssistantReply(convId, payloadMessages) {
    setError(null);
    setIsSending(true);
    setIsWaitingForFirstToken(true);

    const assistantId = newId();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          model: settings.model,
          systemPrompt: settings.systemPrompt || undefined,
          knowledgeBase: compileKnowledgeBase(settings.knowledgeBase) || undefined,
        }),
        signal: controller.signal,
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
      if (err.name === "AbortError") {
        // The user clicked Stop — not an error. Whatever text had already
        // streamed in stays exactly as it is; if nothing had arrived yet,
        // drop the empty assistant bubble instead of leaving a blank one.
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.filter((m) => m.id !== assistantId || m.content) }
              : c
          )
        );
      } else {
        setError(`Could not reach the backend server at ${API_BASE_URL}. Check that it's running and reachable.`);
      }
    } finally {
      setIsSending(false);
      setIsWaitingForFirstToken(false);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
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
          title: isFirstMessage && !c.titleLocked ? deriveTitle(titleSource) : c.title,
          messages: [...c.messages, userMsg],
        };
      })
    );

    // Built explicitly (not read back from state) since the setConversations
    // call above is async — this always reflects exactly what we just sent.
    const payloadMessages = [...activeConversation.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await streamAssistantReply(convId, payloadMessages);
  }

  // Drops the given assistant reply (and re-derives from everything before
  // it) and asks for a fresh one — only ever called on the last message in
  // a conversation, so nothing after it needs to move.
  async function handleRegenerate(messageId) {
    if (!activeConversation || isSending) return;
    const convId = activeConversation.id;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const truncated = activeConversation.messages.slice(0, idx);
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, messages: truncated } : c)));

    const payloadMessages = truncated.map((m) => ({ role: m.role, content: m.content }));
    await streamAssistantReply(convId, payloadMessages);
  }

  // Replaces a previously-sent user message with new text, drops everything
  // that came after it (its old reply included), and asks for a new reply —
  // the same "edit and resend" behavior most chat apps offer.
  async function handleEditResend(messageId, newText) {
    if (!activeConversation || isSending) return;
    const trimmed = newText.trim();
    if (!trimmed) return;

    const convId = activeConversation.id;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const before = activeConversation.messages.slice(0, idx);
    const editedMsg = { id: newId(), role: "user", content: trimmed, display: trimmed, timestamp: Date.now() };
    const updatedMessages = [...before, editedMsg];

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const isFirstMessage = before.length === 0;
        return {
          ...c,
          title: isFirstMessage && !c.titleLocked ? deriveTitle(trimmed) : c.title,
          messages: updatedMessages,
        };
      })
    );

    const payloadMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }));
    await streamAssistantReply(convId, payloadMessages);
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
        onRename={handleRename}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isOpen={isSidebarOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <ChatWindow
        conversation={activeConversation}
        isWaitingForFirstToken={isWaitingForFirstToken}
        error={error}
        onSend={handleSend}
        onRegenerate={handleRegenerate}
        onEditResend={handleEditResend}
        onReaction={handleReaction}
        onStop={handleStop}
        isSending={isSending}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        apiBaseUrl={API_BASE_URL}
      />
      {isSettingsOpen && (
        <SettingsPanel
          settings={settings}
          apiBaseUrl={API_BASE_URL}
          onSave={(next) => {
            setSettings(next);
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
