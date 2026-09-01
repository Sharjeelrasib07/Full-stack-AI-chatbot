import { useEffect, useMemo, useRef, useState } from "react";
import { PERSONAS } from "../lib/personas";
import { IconSearch, IconPlus, IconSun, IconMoon, IconSettings, IconBot } from "./Icons";
import PersonaIcon from "./PersonaIcon";

// A spotlight-style quick action menu (Ctrl/Cmd+K). Everything here is a
// plain, fully custom list — no native <select>/<datalist>, so arrow-key
// navigation, Enter, and Escape are all handled explicitly below and
// behave predictably in every browser, unlike a native autofill dropdown.
export default function CommandPalette({
  conversations,
  theme,
  onNewChat,
  onSelectConversation,
  onSelectPersona,
  onToggleTheme,
  onOpenSettings,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allCommands = useMemo(() => {
    const items = [
      { id: "new-chat", label: "New chat", group: "Action", Icon: IconPlus, action: onNewChat },
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        group: "Action",
        Icon: theme === "dark" ? IconSun : IconMoon,
        action: onToggleTheme,
      },
      { id: "open-settings", label: "Open settings", group: "Action", Icon: IconSettings, action: onOpenSettings },
    ];
    PERSONAS.forEach((p) => {
      items.push({
        id: `persona-${p.id}`,
        label: `Switch to ${p.name}`,
        group: "Persona",
        Icon: (props) => <PersonaIcon icon={p.icon} {...props} />,
        action: () => onSelectPersona(p.id),
      });
    });
    conversations.forEach((c) => {
      items.push({
        id: `conv-${c.id}`,
        label: c.title || "New Chat",
        group: "Conversation",
        Icon: IconBot,
        action: () => onSelectConversation(c.id),
      });
    });
    return items;
  }, [conversations, theme, onNewChat, onToggleTheme, onOpenSettings, onSelectPersona, onSelectConversation]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter((c) => c.label.toLowerCase().includes(q));
  }, [allCommands, query]);

  // Keep the selection in range whenever the filtered list changes size
  // (e.g. the user keeps typing and narrows the results).
  useEffect(() => {
    setSelectedIndex((i) => Math.max(0, Math.min(i, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function runCommand(cmd) {
    if (!cmd) return;
    cmd.action();
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCommand(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette__input-row">
          <IconSearch />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search conversations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <kbd className="palette__esc">Esc</kbd>
        </div>

        <div className="palette__list" ref={listRef} role="listbox">
          {filtered.length === 0 && <p className="palette__empty">No matches</p>}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              className={`palette__item ${i === selectedIndex ? "palette__item--selected" : ""}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => runCommand(cmd)}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span className="palette__item-icon">
                <cmd.Icon />
              </span>
              <span className="palette__item-label">{cmd.label}</span>
              <span className="palette__item-group">{cmd.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
