import { useEffect, useRef } from "react";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";

export default function ChatWindow({
  conversation,
  isWaitingForFirstToken,
  error,
  onSend,
  isSending,
  onToggleSidebar,
}) {
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, isWaitingForFirstToken]);

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function handleInput(e) {
    autoResize(e.target);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const el = textareaRef.current;
    const text = el.value.trim();
    if (!text || isSending) return;
    el.value = "";
    autoResize(el);
    onSend(text);
  }

  return (
    <section className="chat-window">
      <header className="chat-window__header">
        <button className="sidebar-toggle" onClick={onToggleSidebar} title="Toggle conversations">
          ☰
        </button>
        <div>
          <h1>{conversation?.title || "AI Chatbot"}</h1>
          <p>Ask me anything</p>
        </div>
      </header>

      <main className="chat">
        {(!conversation || conversation.messages.length === 0) && !isWaitingForFirstToken && (
          <div className="chat__empty">
            <p>👋 Say hello to start the conversation.</p>
          </div>
        )}

        {conversation?.messages.map((m) => (
          <Message key={m.id} role={m.role} content={m.content} timestamp={m.timestamp} />
        ))}

        {isWaitingForFirstToken && <TypingIndicator />}
        {error && <div className="msg msg--error">{error}</div>}

        <div ref={chatEndRef} />
      </main>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a message... (Enter to send, Shift+Enter for a new line)"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button type="submit" disabled={isSending}>
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
