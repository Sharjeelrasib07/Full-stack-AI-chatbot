import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Message({ role, content, display, attachment, timestamp }) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  // User messages carry `display` (the typed caption, which can be empty
  // for an image sent with no text) separately from `content` (what was
  // actually sent to the API — a plain string, or a multimodal array for
  // an image message). Assistant replies are always a plain string.
  const userText = display ?? (typeof content === "string" ? content : "");
  const imageUrl =
    attachment?.type === "image" && Array.isArray(content)
      ? content.find((part) => part.type === "image_url")?.image_url?.url
      : null;

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
            <>
              {imageUrl && <img className="msg-image" src={imageUrl} alt="Attached" />}
              {attachment?.type === "document" && (
                <div className="msg-file-chip">
                  <span>📄</span> {attachment.name}
                </div>
              )}
              {attachment?.type === "voice" && (
                <span className="msg-voice-badge" title="Sent as a voice note">
                  🎤
                </span>
              )}
              {userText}
            </>
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
