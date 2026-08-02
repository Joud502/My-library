/** Filtre de langage : détecte les mots vulgaires / haineux (FR + EN). */

const BAD_WORDS = [
  // fr
  "connard", "connasse", "salope", "salopard", "enculé", "encule", "enfoiré", "enfoire",
  "pute", "putain", "batard", "bâtard", "nique", "niquer", "ntm", "tapette", "pédé", "pede",
  "bite", "couille", "chatte", "zizi", "baise", "baiser", "branler", "branleur", "merde",
  "chienne", "pouffiasse", "trouduc", "fdp", "pd", "youpin", "bougnoule", "negre", "nègre",
  "sale arabe", "sale juif", "sale noir", "viol", "violeur", "pedophile", "pédophile",
  // en
  "fuck", "fucker", "fucking", "shit", "bitch", "bastard", "asshole", "dick", "cock",
  "pussy", "cunt", "slut", "whore", "nigger", "nigga", "faggot", "rape", "rapist",
  "porn", "porno", "sex", "xxx", "nazi", "hitler", "kys", "kill yourself",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s",
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[013457 8@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Retourne le mot interdit détecté, ou null si le texte est acceptable. */
export function findBadWord(value: string): string | null {
  const text = normalize(value);
  if (!text) return null;
  const compact = text.replace(/ /g, "");
  for (const word of BAD_WORDS) {
    const w = normalize(word);
    if (!w) continue;
    if (w.includes(" ")) {
      if (text.includes(w)) return word;
      continue;
    }
    if (new RegExp(`\\b${w}\\b`).test(text)) return word;
    if (w.length >= 5 && compact.includes(w)) return word;
  }
  return null;
}

export function isClean(value: string) {
  return findBadWord(value) === null;
}

/** Message d'erreur prêt à afficher, ou null. */
export function languageError(value: string, field: string): string | null {
  const bad = findBadWord(value);
  return bad ? `${field} contient un terme inapproprié (« ${bad} »).` : null;
}
