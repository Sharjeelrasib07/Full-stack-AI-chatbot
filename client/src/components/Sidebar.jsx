import { useEffect, useRef, useState } from "react";
import { IconBot, IconPlus, IconTrash, IconSun, IconMoon, IconSearch, IconEdit, IconSettings } from "./Icons";

// Pulls plain text out of a message's `content` regardless of shape — a
// user message with an image attached stores content as a multimodal
// array, not a string, and search needs to look past that to whatever
// caption text (if any) came with it.
function messageText(m) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }
  return "";
}

function conversationMatches(conversation, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if ((conversation.title || "").toLowerCase().includes(q)) return true;
  return conversation.messages.some((m) => messageText(m).toLowerCase().includes(q));
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  theme,
  onToggleTheme,
  isOpen,
  onOpenSettings,
}) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  function startRename(c) {
    setRenamingId(c.id);
    setRenameValue(c.title || "");
  }

  function commitRename() {
    if (renamingId) onRename(renamingId, renameValue);
    setRenamingId(null);
  }

  function handleRenameKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      setRenamingId(null);
    }
  }

  const filtered = conversations.filter((c) => conversationMatches(c, query));

  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">
          <IconBot />
        </span>
        <span className="sidebar__brand-name">AI Chatbot</span>
      </div>

      <button className="sidebar__new-chat" onClick={onNewChat}>
        <span className="icon">
          <IconPlus />
        </span>
        New Chat
      </button>

      <label className="sidebar__search">
        <IconSearch />
        <input
          type="text"
          placeholder="Search conversations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </label>

      <nav className="sidebar__list">
        {filtered.length === 0 && (
          <p className="sidebar__empty">
            {conversations.length === 0 ? "No conversations yet" : "No matches"}
          </p>
        )}
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`sidebar__item ${c.id === activeId ? "sidebar__item--active" : ""}`}
            onClick={() => renamingId !== c.id && onSelect(c.id)}
          >
            {renamingId === c.id ? (
              <input
                ref={renameInputRef}
                className="sidebar__rename-input"
                value={renameValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                maxLength={60}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            ) : (
              <span className="sidebar__item-title">{c.title || "New Chat"}</span>
            )}

            {renamingId !== c.id && (
              <div className="sidebar__item-actions">
                <button
                  className="sidebar__item-action"
                  title="Rename conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(c);
                  }}
                >
                  <IconEdit />
                </button>
                <button
                  className="sidebar__item-action sidebar__item-action--danger"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                >
                  <IconTrash />
                </button>
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button className="sidebar__theme-toggle" onClick={onToggleTheme}>
          {theme === "dark" ? <IconSun /> : <IconMoon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button className="sidebar__settings-btn" onClick={onOpenSettings} title="Settings">
          <IconSettings />
        </button>
      </div>
    </aside>
  );
}
