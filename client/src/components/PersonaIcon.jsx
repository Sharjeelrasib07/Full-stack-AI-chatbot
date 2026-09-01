import { IconBriefcase, IconCode, IconFeather, IconGraduation, IconSparkWave } from "./Icons";

// Single source of truth for persona.icon (a plain string key in
// lib/personas.js, so that file stays framework-agnostic data) -> the
// actual icon component. Used by the persona gallery, the command
// palette, and the sidebar/header badges, so they can never drift apart.
const PERSONA_ICON_COMPONENTS = {
  spark: IconSparkWave,
  briefcase: IconBriefcase,
  code: IconCode,
  feather: IconFeather,
  graduation: IconGraduation,
};

export default function PersonaIcon({ icon, ...props }) {
  const Icon = PERSONA_ICON_COMPONENTS[icon] || IconSparkWave;
  return <Icon {...props} />;
}
