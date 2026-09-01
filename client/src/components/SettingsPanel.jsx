import { useState } from "react";
import { AVAILABLE_MODELS } from "../lib/storage";
import { IconClose, IconSettings } from "./Icons";

const MAX_SYSTEM_PROMPT_CHARS = 2000;

// A small modal for choosing which OpenAI model replies come from and,
// optionally, overriding the assistant's default system prompt (its
// personality/instructions). Both are sent to the backend with every
// request — see App.jsx's streamAssistantReply and server.js's /api/chat,
// which validates the model against an allow-list and clamps the prompt
// length itself, so this UI only needs to give the user a sane way to
// produce those two values.
export default function SettingsPanel({ settings, onSave, onClose }) {
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || "");

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ model, systemPrompt: systemPrompt.trim().slice(0, MAX_SYSTEM_PROMPT_CHARS) });
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
                Custom instructions <span className="field__hint">(optional)</span>
              </span>
              <textarea
                rows={4}
                placeholder="e.g. Answer like a patient tutor and always show a short example."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                maxLength={MAX_SYSTEM_PROMPT_CHARS}
              />
              <span className="field__counter">
                {systemPrompt.length}/{MAX_SYSTEM_PROMPT_CHARS}
              </span>
            </label>
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
