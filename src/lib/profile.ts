import { supabase } from "@/integrations/supabase/client";
import type { Book, Serie } from "@/lib/library";

export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  is_public: boolean;
  allow_chat: boolean;
  created_at: string;
};

const FIELDS = "id, display_name, username, is_public, allow_chat, created_at";

export async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data, error } = await supabase.from("profiles").select(FIELDS).eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function isUsernameAvailable(username: string) {
  const value = username.trim().toLowerCase();
  if (!value) return false;
  const userId = await getUserId();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", value)
    .maybeSingle();
  return !data || (data as { id: string }).id === userId;
}

export async function updateMyProfile(patch: {
  username?: string | null;
  display_name?: string | null;
  is_public?: boolean;
  allow_chat?: boolean;
}) {
  const userId = await getUserId();
  if (!userId) throw new Error("Session expirée, reconnectez-vous.");
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...patch }, { onConflict: "id" });
  if (error) {
    if (error.code === "23505") throw new Error("Ce pseudo est déjà utilisé.");
    throw error;
  }
}

export async function fetchPublicProfiles(search = ""): Promise<Profile[]> {
  let query = supabase
    .from("profiles")
    .select(FIELDS)
    .eq("is_public", true)
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (search.trim()) query = query.ilike("username", `%${search.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchPublicAlbum(username: string): Promise<{
  profile: Profile;
  books: Book[];
  series: Serie[];
} | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(FIELDS)
    .ilike("username", username)
    .eq("is_public", true)
    .maybeSingle();
  if (!profile) return null;
  const p = profile as Profile;
  const [{ data: books }, { data: series }] = await Promise.all([
    supabase.from("books").select("*").eq("user_id", p.id).order("created_at", { ascending: false }),
    supabase.from("series").select("*").eq("user_id", p.id).order("created_at", { ascending: false }),
  ]);
  return { profile: p, books: (books ?? []) as Book[], series: (series ?? []) as Serie[] };
}
