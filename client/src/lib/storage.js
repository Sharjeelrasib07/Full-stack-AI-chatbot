// storage.js
// Small helpers around localStorage so conversations and theme preference
// survive a page refresh. All reads are defensive (try/catch + fallback)
// since localStorage can throw or be unavailable in some browser contexts.

const CONVERSATIONS_KEY = "ai-chatbot:conversations";
const ACTIVE_ID_KEY = "ai-chatbot:activeId";
const THEME_KEY = "ai-chatbot:theme";

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore — storage might be full or disabled. The app still works,
    // it just won't persist between refreshes.
  }
}

export function loadConversations() {
  const raw = safeGet(CONVERSATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations) {
  safeSet(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function loadActiveId() {
  return safeGet(ACTIVE_ID_KEY);
}

export function saveActiveId(id) {
  safeSet(ACTIVE_ID_KEY, id ?? "");
}

export function loadTheme() {
  const stored = safeGet(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Fall back to the user's OS preference the first time they visit.
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function saveTheme(theme) {
  safeSet(THEME_KEY, theme);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeConversation() {
  return {
    id: newId(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
  };
}

export function deriveTitle(firstUserMessage) {
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= 32) return trimmed;
  return trimmed.slice(0, 32).trimEnd() + "…";
}
