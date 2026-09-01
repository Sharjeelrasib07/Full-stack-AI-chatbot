import { useEffect, useRef, useState } from "react";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";
import { resizeImageToDataUrl, isImageFile, ACCEPTED_DOCUMENT_TYPES, formatFileSize } from "../lib/attachments";
import { IconMenu, IconSparkWave, IconFile, IconClose, IconPaperclip, IconMic, IconMicStop, IconSend } from "./Icons";

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

export default function ChatWindow({
  conversation,
  isWaitingForFirstToken,
  error,
  onSend,
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

  return (
    <section className="chat-window">
      <header className="chat-window__header">
        <button className="sidebar-toggle" onClick={onToggleSidebar} title="Toggle conversations">
          <IconMenu />
        </button>
        <div>
          <h1>{conversation?.title || "AI Chatbot"}</h1>
          <p>Ask me anything</p>
        </div>
      </header>

      <main className="chat">
        {(!conversation || conversation.messages.length === 0) && !isWaitingForFirstToken && (
          <div className="chat__empty">
            <span className="chat__empty-icon">
              <IconSparkWave />
            </span>
            <p>Say hello to start the conversation.</p>
          </div>
        )}

        {conversation?.messages.map((m) => (
          <Message
            key={m.id}
            role={m.role}
            content={m.content}
            display={m.display}
            attachment={m.attachment}
            timestamp={m.timestamp}
          />
        ))}

        {isWaitingForFirstToken && <TypingIndicator />}
        {error && <div className="msg msg--error">{error}</div>}

        <div ref={chatEndRef} />
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

        <button type="submit" disabled={sendDisabled}>
          <IconSend />
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
