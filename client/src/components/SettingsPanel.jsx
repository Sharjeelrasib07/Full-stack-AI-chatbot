import { useRef, useState } from "react";
import { AVAILABLE_MODELS, MAX_KB_DOCS, MAX_KB_DOC_CHARS } from "../lib/storage";
import { ACCEPTED_DOCUMENT_TYPES } from "../lib/attachments";
import { IconClose, IconSettings, IconFile, IconPlus, IconTrash } from "./Icons";

const MAX_SYSTEM_PROMPT_CHARS = 2000;

// A small modal for customizing how the assistant behaves: which OpenAI
// model replies come from, free-text custom instructions (a business's
// persona, tone, and policies belong here), and a "knowledge base" of
// reference documents that get resent with every message. All three are
// sent to the backend with every request — see App.jsx's
// streamAssistantReply and server.js's /api/chat, which validates the
// model against an allow-list and clamps both text fields itself, so this
// UI only needs to give the user a sane way to produce those values.
export default function SettingsPanel({ settings, apiBaseUrl, onSave, onClose }) {
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || "");
  const [knowledgeBase, setKnowledgeBase] = useState(settings.knowledgeBase || []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      model,
      systemPrompt: systemPrompt.trim().slice(0, MAX_SYSTEM_PROMPT_CHARS),
      knowledgeBase,
    });
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;

    setUploadError(null);
    if (knowledgeBase.length >= MAX_KB_DOCS) {
      setUploadError(`You can attach up to ${MAX_KB_DOCS} documents. Remove one first.`);
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("document", file);
      const res = await fetch(`${apiBaseUrl}/api/extract`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error || "Could not read that document.");
        return;
      }
      const text = (data.text || "").slice(0, MAX_KB_DOC_CHARS);
      setKnowledgeBase((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: data.filename || file.name, text },
      ]);
    } catch {
      setUploadError(`Could not reach the backend server at ${apiBaseUrl}.`);
    } finally {
      setIsUploading(false);
    }
  }

  function removeDoc(id) {
    setKnowledgeBase((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-panel__header">
          <h2>
            <span className="modal-panel__icon">
              <IconSettings />
            </span>
            Settings
          </h2>
          <button type="button" className="icon-btn icon-btn--ghost" onClick={onClose} title="Close">
            <IconClose />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="modal-panel__body">
            <label className="field">
              <span className="field__label">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.hint}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">
                Custom instructions <span className="field__hint">(persona, tone, policies)</span>
              </span>
              <textarea
                rows={4}
                autoComplete="off"
                placeholder={
                  'e.g. "You are the assistant for Rasib Furniture Co. We sell handmade ' +
                  'furniture in Lahore. Be warm and professional, keep replies short, and ' +
                  'mention our 30-day return policy when it\'s relevant."'
                }
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                maxLength={MAX_SYSTEM_PROMPT_CHARS}
              />
              <span className="field__counter">
                {systemPrompt.length}/{MAX_SYSTEM_PROMPT_CHARS}
              </span>
            </label>

            <div className="field">
              <span className="field__label">
                Business knowledge <span className="field__hint">(optional, up to {MAX_KB_DOCS} documents)</span>
              </span>
              <p className="field__description">
                Upload reference documents — a price list, an FAQ, a past proposal — and the
                assistant will use them to answer questions about your business, on every
                message, automatically.
              </p>

              {knowledgeBase.length > 0 && (
                <ul className="kb-list">
                  {knowledgeBase.map((doc) => (
                    <li key={doc.id} className="kb-list__item">
                      <span className="kb-list__icon">
                        <IconFile />
                      </span>
                      <span className="kb-list__name">{doc.name}</span>
                      <span className="kb-list__size">{doc.text.length.toLocaleString()} chars</span>
                      <button
                        type="button"
                        className="kb-list__remove"
                        onClick={() => removeDoc(doc.id)}
                        title="Remove document"
                      >
                        <IconTrash />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_DOCUMENT_TYPES}
                hidden
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm kb-add-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || knowledgeBase.length >= MAX_KB_DOCS}
              >
                {isUploading ? (
                  <span className="attach-spinner" />
                ) : (
                  <>
                    <IconPlus />
                    Add document
                  </>
                )}
              </button>
              {uploadError && <p className="field__error">{uploadError}</p>}
            </div>
          </div>

          <div className="modal-panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Save settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
