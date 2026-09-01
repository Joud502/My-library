export type BookSuggestion = {
  key: string;
  title: string;
  author: string;
  year: number | null;
  pages: number | null;
  genre: string | null;
  coverUrl: string | null;
};

const GENERIC_SUBJECTS = /^(series:|accessible book|protected daisy|in library|overdrive)/i;

/** Recherche des livres par titre via Open Library (aucune clé requise). */
export async function searchBooks(query: string, limit = 6): Promise<BookSuggestion[]> {
  const url =
    "https://openlibrary.org/search.json?q=" +
    encodeURIComponent(query) +
    `&limit=${limit}&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Recherche indisponible pour le moment.");
  const json = (await res.json()) as { docs?: any[] };

  return (json.docs ?? []).map((d, i) => {
    const subject: string | undefined = (d.subject ?? []).find(
      (s: string) => !GENERIC_SUBJECTS.test(s) && s.length < 40,
    );
    return {
      key: d.key ?? `doc-${i}`,
      title: d.title ?? "",
      author: d.author_name?.[0] ?? "",
      year: typeof d.first_publish_year === "number" ? d.first_publish_year : null,
      pages: typeof d.number_of_pages_median === "number" ? d.number_of_pages_median : null,
      genre: subject ?? null,
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    };
  });
}

export type FreeRead = {
  /** Lecture en ligne dans le navigateur. */
  readUrl: string | null;
  /** Fichier téléchargeable (EPUB/PDF) ouvrable depuis l'explorateur de fichiers. */
  downloadUrl: string | null;
  fileName: string | null;
  source: string;
};

/**
 * Cherche une édition légale et gratuite (domaine public) du livre :
 * Project Gutenberg d'abord, puis Internet Archive via Open Library.
 */
export async function findFreeRead(title: string, author?: string): Promise<FreeRead | null> {
  const query = [title, author].filter(Boolean).join(" ");

  try {
    const res = await fetch(
      "https://gutendex.com/books?search=" + encodeURIComponent(query) + "&languages=fr,en,es,it,sv,la",
    );
    if (res.ok) {
      const json = (await res.json()) as { results?: any[] };
      const hit = (json.results ?? [])[0];
      if (hit) {
        const f = hit.formats ?? {};
        const readUrl: string | null =
          f["text/html"] ?? f["text/html; charset=utf-8"] ?? f["text/plain; charset=utf-8"] ?? null;
        const downloadUrl: string | null =
          f["application/epub+zip"] ?? f["application/pdf"] ?? f["text/plain; charset=utf-8"] ?? null;
        if (readUrl || downloadUrl) {
          const ext = downloadUrl?.endsWith(".pdf") ? "pdf" : downloadUrl?.includes("epub") ? "epub" : "txt";
          return {
            readUrl,
            downloadUrl,
            fileName: downloadUrl ? `${title.replace(/[^\w\s-]/g, "").trim() || "livre"}.${ext}` : null,
            source: "Project Gutenberg",
          };
        }
      }
    }
  } catch {
    /* on tente la source suivante */
  }

  try {
    const res = await fetch(
      "https://openlibrary.org/search.json?q=" +
        encodeURIComponent(query) +
        "&limit=5&fields=title,ia,ebook_access",
    );
    if (res.ok) {
      const json = (await res.json()) as { docs?: any[] };
      const doc = (json.docs ?? []).find(
        (d) => Array.isArray(d.ia) && d.ia.length && d.ebook_access === "public",
      );
      const id = doc?.ia?.[0];
      if (id) {
        return {
          readUrl: `https://archive.org/details/${id}`,
          downloadUrl: `https://archive.org/download/${id}/${id}.pdf`,
          fileName: `${id}.pdf`,
          source: "Internet Archive",
        };
      }
    }
  } catch {
    /* aucune source */
  }

  return null;
}
