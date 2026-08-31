import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Message({ role, content, timestamp }) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — fail silently.
    }
  }

  return (
    <div className={`message-row ${isUser ? "message-row--user" : "message-row--assistant"}`}>
      {!isUser && <div className="avatar avatar--ai">🤖</div>}

      <div className="message-col">
        <div className={`msg ${isUser ? "msg--user" : "msg--assistant"}`}>
          {isUser ? (
            content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || " "}</ReactMarkdown>
          )}
        </div>
        <div className="message-meta">
          <span className="message-time">{formatTime(timestamp)}</span>
          {!isUser && content && (
            <button className="message-copy" onClick={handleCopy} title="Copy reply">
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {isUser && <div className="avatar avatar--user">🧑</div>}
    </div>
  );
}
