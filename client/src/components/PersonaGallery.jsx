import { PERSONAS } from "../lib/personas";
import { IconClose, IconCheck } from "./Icons";
import PersonaIcon from "./PersonaIcon";

// A visual, one-click alternative to typing custom instructions from
// scratch — each card is a ready-tuned "mode" for the assistant. Picking
// one sets settings.systemPrompt (still editable afterward in Settings)
// and settings.personaId, which App.jsx and ChatWindow use to show a
// badge for whichever one is currently active.
export default function PersonaGallery({ activePersonaId, onSelect, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-panel__header">
          <h2>Choose a persona</h2>
          <button type="button" className="icon-btn icon-btn--ghost" onClick={onClose} title="Close">
            <IconClose />
          </button>
        </header>

        <div className="modal-panel__body">
          <p className="field__description" style={{ margin: "-4px 0 4px" }}>
            Switches the assistant's behavior instantly. You can still fine-tune it afterward from
            Settings &gt; Custom instructions.
          </p>
          <div className="persona-grid">
            {PERSONAS.map((p) => {
              const isActive = p.id === activePersonaId;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`persona-card ${isActive ? "persona-card--active" : ""}`}
                  style={{ "--persona-color": p.color }}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="persona-card__icon">
                    <PersonaIcon icon={p.icon} />
                  </span>
                  <span className="persona-card__name">
                    {p.name}
                    {isActive && (
                      <span className="persona-card__check">
                        <IconCheck />
                      </span>
                    )}
                  </span>
                  <span className="persona-card__desc">{p.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
