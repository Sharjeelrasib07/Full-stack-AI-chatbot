import { useEffect, useRef, useState } from "react";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";
import { resizeImageToDataUrl, isImageFile, ACCEPTED_DOCUMENT_TYPES, formatFileSize } from "../lib/attachments";
import {
  IconMenu,
  IconSparkWave,
  IconFile,
  IconClose,
  IconPaperclip,
  IconMic,
  IconMicStop,
  IconSend,
  IconDownload,
} from "./Icons";

const CAN_RECORD_AUDIO =
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window !== "undefined" &&
  !!window.MediaRecorder;

function recordingFilename(mimeType) {
  if (mimeType?.includes("mp4")) return "voice-note.mp4";
  if (mimeType?.includes("ogg")) return "voice-note.ogg";
  return "voice-note.webm";
}

// A handful of one-tap conversation starters shown only on a brand-new,
// empty conversation — purely a convenience so a blank screen doesn't
// leave the user wondering what to type.
const STARTER_PROMPTS = [
  "Explain a tricky concept simply",
  "Help me write a professional email",
  "Give me feedback on an idea",
  "Debug a piece of code with me",
];

function messageTextForExport(m) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ") || "[image]";
  }
  return "";
}

// Builds a plain-text transcript and triggers a browser download — no
// backend involvement needed, this is purely client-side.
function exportConversation(conversation) {
  const lines = [`${conversation.title || "Conversation"}`, ""];
  conversation.messages.forEach((m) => {
    const who = m.role === "user" ? "You" : "Assistant";
    const when = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";
    lines.push(`${who}${when ? ` (${when})` : ""}:`);
    lines.push(messageTextForExport(m).trim() || "(empty)");
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(conversation.title || "conversation").replace(/[^\w\- ]+/g, "").trim() || "conversation"}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ChatWindow({
  conversation,
  isWaitingForFirstToken,
  error,
  onSend,
  onRegenerate,
  onEditResend,
  onReaction,
  onStop,
  isSending,
  onToggleSidebar,
  apiBaseUrl,
}) {
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const [pendingAttachment, setPendingAttachment] = useState(null); // { type: 'image', dataUrl, name } | { type: 'document', name, text, truncated }
  const [isExtracting, setIsExtracting] = useState(false);
  const [attachError, setAttachError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, isWaitingForFirstToken]);

  useEffect(() => {
    // Stop the mic and any timer if the component unmounts mid-recording.
    return () => {
      clearInterval(recordingTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
    if (isSending || isExtracting) return;
    if (!text && !pendingAttachment) return;

    const payload = { text };
    if (pendingAttachment?.type === "image") payload.image = pendingAttachment;
    if (pendingAttachment?.type === "document") payload.document = pendingAttachment;

    el.value = "";
    autoResize(el);
    setPendingAttachment(null);
    setAttachError(null);
    onSend(payload);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;

    setAttachError(null);
    setPendingAttachment(null);

    if (isImageFile(file)) {
      try {
        const dataUrl = await resizeImageToDataUrl(file);
        setPendingAttachment({ type: "image", dataUrl, name: file.name });
      } catch (err) {
        setAttachError(err.message || "Could not process that image.");
      }
      return;
    }

    setIsExtracting(true);
    try {
      const form = new FormData();
      form.append("document", file);
      const res = await fetch(`${apiBaseUrl}/api/extract`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttachError(data.error || "Could not read that document.");
        return;
      }
      setPendingAttachment({
        type: "document",
        name: data.filename || file.name,
        size: file.size,
        text: data.text,
        truncated: data.truncated,
      });
    } catch {
      setAttachError(`Could not reach the backend server at ${apiBaseUrl}.`);
    } finally {
      setIsExtracting(false);
    }
  }

  async function startRecording() {
    setAttachError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingStop;
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setAttachError("Couldn't access your microphone. Check your browser's microphone permission for this site.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  }

  async function handleRecordingStop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const mimeType = mediaRecorderRef.current?.mimeType;
    const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });

    if (blob.size < 800) {
      // Essentially empty — e.g. an accidental tap with no real speech.
      return;
    }

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, recordingFilename(mimeType));
      const res = await fetch(`${apiBaseUrl}/api/transcribe`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttachError(data.error || "Could not transcribe that voice note.");
        return;
      }
      const text = (data.text || "").trim();
      if (text) {
        onSend({ text, isVoice: true });
      } else {
        setAttachError("Didn't catch any speech in that recording — please try again.");
      }
    } catch {
      setAttachError(`Could not reach the backend server at ${apiBaseUrl}.`);
    } finally {
      setIsTranscribing(false);
    }
  }

  function formatRecordingTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const sendDisabled = isSending || isExtracting;

  const messages = conversation?.messages || [];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  function handleStarterClick(prompt) {
    if (sendDisabled) return;
    onSend({ text: prompt });
  }

  return (
    <section className="chat-window">
      <header className="chat-window__header">
        <button className="sidebar-toggle" onClick={onToggleSidebar} title="Toggle conversations">
          <IconMenu />
        </button>
        <div className="chat-window__header-text">
          <h1>{conversation?.title || "AI Chatbot"}</h1>
          <p>Ask me anything</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="chat-window__export"
            onClick={() => exportConversation(conversation)}
            title="Download this conversation as a text file"
          >
            <IconDownload />
          </button>
        )}
      </header>

      <main className="chat">
        {messages.length === 0 && !isWaitingForFirstToken ? (
          <div className="chat__empty">
            <span className="chat__empty-icon">
              <IconSparkWave />
            </span>
            <p>Say hello to start the conversation.</p>
            <div className="chat__starters">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chat__starter"
                  onClick={() => handleStarterClick(prompt)}
                  disabled={sendDisabled}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // A short conversation should sit at the bottom of the chat area
          // (next to the input box) rather than leaving a big empty gap
          // above it — but that has to come from THIS wrapper's own
          // margin-top:auto, not from justify-content on the scrolling
          // .chat above. justify-content:flex-end on a scroll container
          // is a known trap: once content overflows, some browsers can't
          // scroll all the way back up to the start of it — exactly the
          // "can't scroll to the top of a long reply" bug this replaced.
          <div className="chat__inner">
            {messages.map((m) => (
              <Message
                key={m.id}
                id={m.id}
                role={m.role}
                content={m.content}
                display={m.display}
                attachment={m.attachment}
                timestamp={m.timestamp}
                reaction={m.reaction}
                isLastAssistant={m.id === lastAssistantId}
                isSending={isSending}
                onRegenerate={onRegenerate}
                onEditResend={onEditResend}
                onReaction={onReaction}
              />
            ))}

            {isWaitingForFirstToken && <TypingIndicator />}
            {error && <div className="msg msg--error">{error}</div>}

            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {attachError && <div className="attach-error">{attachError}</div>}

      {pendingAttachment && (
        <div className="attach-preview">
          {pendingAttachment.type === "image" ? (
            <img className="attach-preview__thumb" src={pendingAttachment.dataUrl} alt="Attached preview" />
          ) : (
            <span className="attach-preview__icon">
              <IconFile />
            </span>
          )}
          <div className="attach-preview__info">
            <span className="attach-preview__name">{pendingAttachment.name}</span>
            {pendingAttachment.type === "document" && (
              <span className="attach-preview__meta">
                {pendingAttachment.size ? formatFileSize(pendingAttachment.size) : "Document"}
                {pendingAttachment.truncated ? " · using first part only" : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            className="attach-preview__remove"
            onClick={() => setPendingAttachment(null)}
            title="Remove attachment"
          >
            <IconClose />
          </button>
        </div>
      )}

      {isExtracting && (
        <div className="attach-preview attach-preview--loading">
          <span className="attach-spinner" /> Reading document…
        </div>
      )}

      {isRecording && (
        <div className="recording-bar">
          <span className="recording-dot" />
          Recording {formatRecordingTime(recordingSeconds)}
          <button type="button" className="recording-stop" onClick={stopRecording}>
            Stop &amp; send
          </button>
        </div>
      )}

      {isTranscribing && (
        <div className="recording-bar recording-bar--transcribing">
          <span className="attach-spinner" /> Transcribing voice note…
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={`image/*,${ACCEPTED_DOCUMENT_TYPES}`}
          hidden
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendDisabled || isRecording}
          title="Attach an image or document"
        >
          <IconPaperclip />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a message... (Enter to send, Shift+Enter for a new line)"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          autoComplete="off"
          spellCheck="true"
        />

        {CAN_RECORD_AUDIO && (
          <button
            type="button"
            className={`icon-btn ${isRecording ? "icon-btn--recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sendDisabled || isTranscribing}
            title={isRecording ? "Stop recording" : "Record a voice note"}
          >
            {isRecording ? <IconMicStop /> : <IconMic />}
          </button>
        )}

        {isSending ? (
          <button type="button" className="chat-form__stop" onClick={onStop} title="Stop generating">
            <IconMicStop />
            Stop
          </button>
        ) : (
          <button type="submit" disabled={sendDisabled}>
            <IconSend />
            Send
          </button>
        )}
      </form>
    </section>
  );
}
