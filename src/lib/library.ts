import { supabase } from "@/integrations/supabase/client";

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  genre: string | null;
  published_year: number | null;
  pages: number | null;
  rating: number | null;
  status: string;
  notes: string | null;
  series_id: string | null;
  created_at: string;
};

export type Serie = {
  id: string;
  user_id: string;
  name: string;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  created_at: string;
};

export const STATUS_LABELS: Record<string, string> = {
  a_lire: "À lire",
  en_cours: "En cours",
  lu: "Lu",
};

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Book[];
}

export async function fetchSeries(): Promise<Serie[]> {
  const { data, error } = await supabase
    .from("series")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Serie[];
}

/** Nombre de personnes possédant le même titre, par titre normalisé. */
export async function fetchOwnerCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("book_owner_counts");
  if (error) return {};
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { title_key: string; owners: number }[]) {
    map[row.title_key] = Number(row.owners);
  }
  return map;
}

/** Normalisation d'un texte : minuscules, sans accents ni ponctuation. */
function norm(txt: string) {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Deux livres sont « les mêmes » s'ils partagent titre + auteur normalisés.
 * La description, la couverture ou l'année n'entrent pas dans la comparaison.
 */
export function titleKey(title: string, author = "") {
  return `${norm(title)}|${norm(author)}`;
}

export async function deleteBook(id: string) {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteSerie(id: string) {
  const { error } = await supabase.from("series").delete().eq("id", id);
  if (error) throw error;
}

/** Uploads a cover to the private bucket and returns its storage path. */
export async function uploadCover(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Session expirée, reconnectez-vous.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("covers").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getCoverUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage.from("covers").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type BookUpdate = {
  title: string;
  author: string;
  genre: string | null;
  published_year: number | null;
  pages: number | null;
  rating: number | null;
  status: string;
  notes: string | null;
  series_id: string | null;
};

export async function updateBook(id: string, values: BookUpdate) {
  const { error } = await supabase.from("books").update(values).eq("id", id);
  if (error) throw error;
}
