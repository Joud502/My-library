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
