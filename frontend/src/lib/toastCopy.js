// Picks a random line from a locale toast/greeting array and fills in any
// {placeholder} tokens (UPDATES.md round 4 #2: in-voice, varied copy instead
// of the same flat system string every time).
export function pickLine(lines, vars = {}) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  const line = lines[Math.floor(Math.random() * lines.length)];
  return Object.entries(vars).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(value), line);
}
