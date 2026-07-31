/** Vérifications IA (titre réel / image NSFW-gore) — code serveur uniquement. */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Msg = { role: "system" | "user"; content: unknown };

async function askJson(messages: Msg[]): Promise<Record<string, unknown> | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Le titre correspond-il à un ouvrage réel connu d'Open Library ? */
export async function existsInOpenLibrary(title: string, author?: string) {
  try {
    const url =
      "https://openlibrary.org/search.json?limit=5&fields=title,author_name&q=" +
      encodeURIComponent([title, author].filter(Boolean).join(" "));
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = (await res.json()) as { docs?: { title?: string }[] };
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
    const target = norm(title);
    return (json.docs ?? []).some((d) => {
      const t = norm(d.title ?? "");
      return t === target || t.includes(target) || target.includes(t);
    });
  } catch {
    return false;
  }
}

export type TitleVerdict = {
  ok: boolean;
  realBook: boolean;
  reason: string | null;
};

export async function verifyTitle(title: string, author: string): Promise<TitleVerdict> {
  const realBook = await existsInOpenLibrary(title, author);

  const verdict = await askJson([
    {
      role: "system",
      content:
        "Tu vérifies des titres de livres saisis par des utilisateurs. Réponds en JSON strict " +
        '{"plausible": boolean, "offensant": boolean, "raison": string}. ' +
        "plausible = le texte ressemble à un vrai titre de livre (pas du charabia, pas un test, pas une suite de touches). " +
        "offensant = le titre est haineux, sexuellement explicite ou gore. raison en français, courte.",
    },
    { role: "user", content: `Titre: "${title}"\nAuteur: "${author}"` },
  ]);

  if (!verdict) return { ok: true, realBook, reason: null };

  const plausible = verdict.plausible !== false;
  const offensant = verdict.offensant === true;
  const raison = typeof verdict.raison === "string" ? verdict.raison : null;

  if (offensant) return { ok: false, realBook, reason: raison ?? "Titre inapproprié." };
  if (!plausible && !realBook)
    return {
      ok: false,
      realBook,
      reason: raison ?? "Ce titre ne correspond à aucun ouvrage connu et semble invalide.",
    };
  return { ok: true, realBook, reason: null };
}

export type ImageVerdict = {
  nsfw: boolean;
  gore: boolean;
  isBookCover: boolean;
  reason: string | null;
};

export async function verifyImage(imageUrl: string): Promise<ImageVerdict | null> {
  const verdict = await askJson([
    {
      role: "system",
      content:
        "Tu modères des images de couvertures de livres. Réponds en JSON strict " +
        '{"nsfw": boolean, "gore": boolean, "couverture_livre": boolean, "raison": string}. ' +
        "nsfw = nudité ou contenu sexuel. gore = sang, violence graphique, mutilation. " +
        "couverture_livre = l'image peut raisonnablement servir de couverture de livre. raison en français, courte.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyse cette image de couverture." },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ]);
  if (!verdict) return null;
  return {
    nsfw: verdict.nsfw === true,
    gore: verdict.gore === true,
    isBookCover: verdict.couverture_livre !== false,
    reason: typeof verdict.raison === "string" ? verdict.raison : null,
  };
}

export function isAdultFrom(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 18;
}
