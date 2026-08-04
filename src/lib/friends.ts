import { supabase } from "@/integrations/supabase/client";
import { getUserId, type Profile } from "@/lib/profile";

export type FriendStatus = "pending" | "accepted" | "declined";

export type FriendRequest = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
  created_at: string;
};

export type FriendLink = {
  request: FriendRequest;
  peerId: string;
  peer: Profile | null;
  /** true si c'est nous qui avons envoyé la demande */
  outgoing: boolean;
};

const PROFILE_FIELDS = "id, display_name, username, is_public, allow_chat, created_at";

/** Toutes les relations d'amitié me concernant (envoyées et reçues). */
export async function fetchFriendLinks(): Promise<FriendLink[]> {
  const me = await getUserId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const requests = (data ?? []) as FriendRequest[];
  const peerIds = [...new Set(requests.map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id)))];
  const profiles = new Map<string, Profile>();
  if (peerIds.length) {
    const { data: rows } = await supabase.from("profiles").select(PROFILE_FIELDS).in("id", peerIds);
    for (const p of (rows ?? []) as Profile[]) profiles.set(p.id, p);
  }
  return requests.map((request) => {
    const peerId = request.requester_id === me ? request.addressee_id : request.requester_id;
    return {
      request,
      peerId,
      peer: profiles.get(peerId) ?? null,
      outgoing: request.requester_id === me,
    };
  });
}

export function friendsOf(links: FriendLink[]) {
  return links.filter((l) => l.request.status === "accepted");
}

export function incomingRequests(links: FriendLink[]) {
  return links.filter((l) => l.request.status === "pending" && !l.outgoing);
}

export function outgoingRequests(links: FriendLink[]) {
  return links.filter((l) => l.request.status === "pending" && l.outgoing);
}

export function linkWith(links: FriendLink[], peerId: string) {
  return links.find((l) => l.peerId === peerId) ?? null;
}

export function isFriend(links: FriendLink[], peerId: string) {
  return links.some((l) => l.peerId === peerId && l.request.status === "accepted");
}

/** Envoie (ou renvoie) une demande d'amitié. */
export async function sendFriendRequest(peerId: string) {
  const me = await getUserId();
  if (!me) throw new Error("Session expirée, reconnectez-vous.");
  if (me === peerId) throw new Error("Vous ne pouvez pas vous ajouter vous-même.");
  // Une demande reçue en attente ? On l'accepte directement.
  const { data: received } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("requester_id", peerId)
    .eq("addressee_id", me)
    .maybeSingle();
  if (received) {
    await respondFriendRequest((received as { id: string }).id, true);
    return;
  }
  const { error } = await supabase
    .from("friend_requests")
    .upsert(
      { requester_id: me, addressee_id: peerId, status: "pending" },
      { onConflict: "requester_id,addressee_id" },
    );
  if (error) throw error;
}

/** Accepte ou refuse une demande reçue. */
export async function respondFriendRequest(id: string, accept: boolean) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  if (error) throw error;
}

/** Annule une demande envoyée ou supprime un lien d'amitié. */
export async function removeFriendLink(id: string) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", id);
  if (error) throw error;
}
