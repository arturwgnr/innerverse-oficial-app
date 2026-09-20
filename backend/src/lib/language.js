// UPDATES.md "Fix: análises da IA sempre saem em inglês, mesmo com language
// = 'pt'": entries.language was already captured but never reached the
// model, so every AI call defaulted to English. This is the one place that
// instruction text lives, shared by every prompt that needs to match its
// output to a stored 'en'/'pt' language value.
const LANGUAGE_INSTRUCTIONS = {
  en: "Write your entire response in English, matching this entry's language field. Never mix languages.",
  pt: "Escreva toda a sua resposta em português, no português natural do Brasil (nunca uma tradução robótica do inglês), de acordo com o campo language desta entrada. Nunca misture idiomas.",
};

export function getLanguageInstruction(language) {
  return LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
}
