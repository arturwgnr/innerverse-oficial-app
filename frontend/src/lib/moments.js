// Fixed, simple convention for v1 (JOURNAL.md section 2). Manual navigation
// between moments is always available regardless of this auto detection.
export const MOMENTS = ["morning", "afternoon", "night", "decompress"];

export function getCurrentMoment(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}
