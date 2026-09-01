import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  IconBot,
  IconUser,
  IconFile,
  IconMic,
  IconCopy,
  IconCheck,
  IconEdit,
  IconRefresh,
  IconThumbUp,
  IconThumbDown,
  IconSpeaker,
  IconSpeakerOff,
  IconCalculator,
  IconSwap,
} from "./Icons";
import { describeToolCall } from "../lib/toolCalls";

const TOOL_CHIP_ICONS = { calculator: IconCalculator, swap: IconSwap };

const CAN_SPEAK = typeof window !== "undefined" && "speechSynthesis" in window;

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Strips the most common markdown punctuation before handing text to the
// speech synthesizer, so it doesn't read out literal asterisks, hashes,
// and backticks.
function stripMarkdownForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Message({
  id,
  role,
  content,
  display,
  attachment,
  timestamp,
  reaction,
  isLastAssistant,
  isSending,
  onRegenerate,
  onEditResend,
  onReaction,
  toolCalls,
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const editRef = useRef(null);
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

  // Editing is only offered for plain typed text — a message with an
  // image or document attached carries extra state (the data URL, the
  // extracted document text) that a simple textarea can't represent, so
  // keep that flow to its original attach-and-send path instead.
  const canEdit = isUser && !attachment;

  useEffect(() => {
    if (isEditing) {
      editRef.current?.focus();
      editRef.current?.setSelectionRange(editValue.length, editValue.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    // If speech synthesis is still going when this message unmounts (e.g.
    // the conversation is switched or deleted mid-speech), stop it rather
    // than leaving a stray voice playing over a different chat.
    return () => {
      if (isSpeaking) window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — fail silently.
    }
  }

  function startEdit() {
    setEditValue(userText);
    setIsEditing(true);
  }

  function saveEdit() {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setIsEditing(false);
    if (trimmed !== userText) onEditResend?.(id, trimmed);
  }

  function handleEditKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  }

  function toggleSpeak() {
    if (!CAN_SPEAK) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel(); // stop anything else already playing
    const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(content || ""));
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  return (
    <div className={`message-row ${isUser ? "message-row--user" : "message-row--assistant"}`}>
      {!isUser && (
        <div className="avatar avatar--ai">
          <IconBot />
        </div>
      )}

      <div className="message-col">
        {isEditing ? (
          <div className="msg-edit">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={Math.min(6, Math.max(2, editValue.split("\n").length))}
              autoComplete="off"
            />
            <div className="msg-edit__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={saveEdit} disabled={isSending}>
                Save &amp; resend
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isUser && toolCalls?.length > 0 && (
              <div className="tool-chips">
                {toolCalls.map((call, i) => {
                  const desc = describeToolCall(call);
                  if (!desc) return null;
                  const ChipIcon = TOOL_CHIP_ICONS[desc.icon] || IconCalculator;
                  return (
                    <span key={i} className={`tool-chip ${desc.failed ? "tool-chip--failed" : ""}`}>
                      <ChipIcon />
                      {desc.text}
                    </span>
                  );
                })}
              </div>
            )}
            <div className={`msg ${isUser ? "msg--user" : "msg--assistant"}`}>
              {isUser ? (
                <>
                  {imageUrl && <img className="msg-image" src={imageUrl} alt="Attached" />}
                  {attachment?.type === "document" && (
                    <div className="msg-file-chip">
                      <IconFile /> {attachment.name}
                    </div>
                  )}
                  {attachment?.type === "voice" && (
                    <span className="msg-voice-badge" title="Sent as a voice note">
                      <IconMic />
                    </span>
                  )}
                  {userText}
                </>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || " "}</ReactMarkdown>
              )}
            </div>
          </>
        )}

        {!isEditing && (
          <div className="message-meta">
            <span className="message-time">{formatTime(timestamp)}</span>

            {isUser && canEdit && (
              <button className="message-action" onClick={startEdit} title="Edit and resend" disabled={isSending}>
                <IconEdit />
                Edit
              </button>
            )}

            {!isUser && content && (
              <>
                <button className="message-action" onClick={handleCopy} title="Copy reply">
                  {copied ? <IconCheck /> : <IconCopy />}
                  {copied ? "Copied" : "Copy"}
                </button>

                {isLastAssistant && (
                  <button
                    className="message-action"
                    onClick={() => onRegenerate?.(id)}
                    title="Regenerate this reply"
                    disabled={isSending}
                  >
                    <IconRefresh />
                    Regenerate
                  </button>
                )}

                {CAN_SPEAK && (
                  <button
                    className={`message-action ${isSpeaking ? "message-action--active" : ""}`}
                    onClick={toggleSpeak}
                    title={isSpeaking ? "Stop reading aloud" : "Read reply aloud"}
                  >
                    {isSpeaking ? <IconSpeakerOff /> : <IconSpeaker />}
                    {isSpeaking ? "Stop" : "Listen"}
                  </button>
                )}

                <span className="message-reactions">
                  <button
                    className={`message-action message-action--icon-only ${reaction === "up" ? "message-action--active" : ""}`}
                    onClick={() => onReaction?.(id, "up")}
                    title="Good reply"
                  >
                    <IconThumbUp />
                  </button>
                  <button
                    className={`message-action message-action--icon-only ${reaction === "down" ? "message-action--active" : ""}`}
                    onClick={() => onReaction?.(id, "down")}
                    title="Not helpful"
                  >
                    <IconThumbDown />
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="avatar avatar--user">
          <IconUser />
        </div>
      )}
    </div>
  );
}
