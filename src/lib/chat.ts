import { supabase } from "@/integrations/supabase/client";
import { getUserId, type Profile } from "@/lib/profile";

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

export type Thread = {
  peerId: string;
  peer: Profile | null;
  last: Message;
  unread: number;
};

export async function fetchMessages(): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function fetchThreads(): Promise<Thread[]> {
  const me = await getUserId();
  if (!me) return [];
  const messages = await fetchMessages();
  const map = new Map<string, Thread>();
  for (const m of messages) {
    const peerId = m.sender_id === me ? m.recipient_id : m.sender_id;
    const current = map.get(peerId);
    const unread = (current?.unread ?? 0) + (m.recipient_id === me && !m.read_at ? 1 : 0);
    map.set(peerId, { peerId, peer: current?.peer ?? null, last: m, unread });
  }
  const ids = [...map.keys()];
  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, is_public, allow_chat, created_at")
      .in("id", ids);
    for (const p of (data ?? []) as Profile[]) {
      const thread = map.get(p.id);
      if (thread) thread.peer = p;
    }
  }
  return [...map.values()].sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}

export function conversationOf(messages: Message[], me: string, peerId: string) {
  return messages.filter(
    (m) =>
      (m.sender_id === me && m.recipient_id === peerId) ||
      (m.sender_id === peerId && m.recipient_id === me),
  );
}

export async function sendMessage(recipientId: string, content: string) {
  const me = await getUserId();
  if (!me) throw new Error("Session expirée, reconnectez-vous.");
  const { error } = await supabase
    .from("messages")
    .insert({ sender_id: me, recipient_id: recipientId, content: content.trim() });
  if (error) {
    if (error.code === "42501") throw new Error("Ce membre n'accepte pas les messages.");
    throw error;
  }
}

export async function markThreadRead(peerId: string) {
  const me = await getUserId();
  if (!me) return;
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", me)
    .eq("sender_id", peerId)
    .is("read_at", null);
}

/** Nom d'un canal temps réel stable pour une paire d'utilisateurs. */
export function pairChannel(prefix: string, a: string, b: string) {
  return `${prefix}-${[a, b].sort().join("-")}`;
}

const FILE_PREFIX = "::file::";

export type Attachment = { path: string; name: string };

/** Détecte une pièce jointe encodée dans le contenu d'un message. */
export function parseAttachment(content: string): Attachment | null {
  if (!content.startsWith(FILE_PREFIX)) return null;
  const [path, name] = content.slice(FILE_PREFIX.length).split("::");
  if (!path) return null;
  return { path, name: name || "fichier" };
}

/** Envoie un fichier dans la conversation (stocké de façon privée). */
export async function sendFile(recipientId: string, file: File) {
  const me = await getUserId();
  if (!me) throw new Error("Session expirée, reconnectez-vous.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Fichier trop lourd (10 Mo max).");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${me}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("chat-files").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { error: insertError } = await supabase
    .from("messages")
    .insert({
      sender_id: me,
      recipient_id: recipientId,
      content: `${FILE_PREFIX}${path}::${safeName}`,
    });
  if (insertError) {
    if (insertError.code === "42501") throw new Error("Ce membre n'accepte pas les messages.");
    throw insertError;
  }
}

/** URL signée temporaire pour télécharger une pièce jointe. */
export async function attachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
