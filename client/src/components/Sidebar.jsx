import { IconBot, IconPlus, IconTrash, IconSun, IconMoon } from "./Icons";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  theme,
  onToggleTheme,
  isOpen,
}) {
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

      <nav className="sidebar__list">
        {conversations.length === 0 && (
          <p className="sidebar__empty">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`sidebar__item ${c.id === activeId ? "sidebar__item--active" : ""}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="sidebar__item-title">{c.title || "New Chat"}</span>
            <button
              className="sidebar__delete"
              title="Delete conversation"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </nav>

      <button className="sidebar__theme-toggle" onClick={onToggleTheme}>
        {theme === "dark" ? <IconSun /> : <IconMoon />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
    </aside>
  );
}
