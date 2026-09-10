// Canonical English labels for the 1-6 mood scale (UPDATES.md round 3 #2),
// used only to give AI prompts readable context for a bare integer stored on
// entries.mood/day_mood_overrides.mood. User-facing display labels (English
// and Portuguese) live in the frontend locale files, this is backend-only
// and always English since it is never shown to a user directly.
export const MOOD_LABELS = {
  1: "Storming",
  2: "Overcast",
  3: "Clouded",
  4: "Clearing",
  5: "Bright",
  6: "Radiant",
};

export function describeMood(mood) {
  if (mood == null) return null;
  const label = MOOD_LABELS[mood];
  return label ? `${label} (${mood}/6)` : null;
}
