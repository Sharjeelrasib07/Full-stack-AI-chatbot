// Icons.jsx
// A small set of hand-picked line icons (consistent 1.75px stroke, 20px
// grid) used throughout the UI instead of emoji — emoji render differently
// across operating systems and read as a placeholder rather than a
// finished product; a single consistent icon set is part of what makes an
// interface feel considered.

const base = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconBot(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6.5" width="13" height="10" rx="3" />
      <path d="M10 6.5V4" />
      <circle cx="10" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="7.25" cy="11.5" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12.75" cy="11.5" r="1.15" fill="currentColor" stroke="none" />
      <path d="M7.5 14.25c.7.55 1.55.85 2.5.85s1.8-.3 2.5-.85" />
      <path d="M1.5 10h2M16.5 10h2" />
    </svg>
  );
}

export function IconUser(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="6.75" r="3.25" />
      <path d="M3.75 16.5c.9-3.4 3.4-5.25 6.25-5.25s5.35 1.85 6.25 5.25" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.2a1 1 0 0 0 1 .8h4.8a1 1 0 0 0 1-.8L14 6" />
    </svg>
  );
}

export function IconSun(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2.5v2M10 15.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M14.6 5.4l-1.4 1.4M6.8 13.2l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 12.2A6.75 6.75 0 0 1 7.8 3.5a6.75 6.75 0 1 0 8.7 8.7Z" />
    </svg>
  );
}

export function IconMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </svg>
  );
}

export function IconPaperclip(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 7.5 8 13a2.5 2.5 0 1 1-3.5-3.5L11 3a1.7 1.7 0 0 1 2.4 2.4l-6.15 6.15a.9.9 0 1 1-1.27-1.27L11.5 5" />
    </svg>
  );
}

export function IconMic(props) {
  return (
    <svg {...base} {...props}>
      <rect x="7.5" y="2.75" width="5" height="8.5" rx="2.5" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.25M7.25 17.25h5.5" />
    </svg>
  );
}

export function IconMicStop(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="6" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSend(props) {
  return (
    <svg {...base} {...props}>
      <path d="M17 3 2.5 9.2c-.7.3-.65 1.3.07 1.53L9 12.7l1.98 6.4c.23.75 1.24.8 1.54.08L17 3Z" />
      <path d="M9 12.7 17 3" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

export function IconFile(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2.75h5.5L15.5 7v9.25a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z" />
      <path d="M11.25 2.75V7h4.25" />
    </svg>
  );
}

export function IconCopy(props) {
  return (
    <svg {...base} {...props}>
      <rect x="7.5" y="7.5" width="9" height="10" rx="1.5" />
      <path d="M13.5 7.5V4.5a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.5l3.8 3.8L16 6" />
    </svg>
  );
}

export function IconSparkWave(props) {
  // Used for the empty-state illustration.
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" fill="none" {...props}>
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <path
        d="M32 16c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      <circle cx="46" cy="20" r="2.3" fill="currentColor" fillOpacity="0.55" />
      <circle cx="18" cy="42" r="1.8" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}
