import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageCircle, Paperclip, Search, Send, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationOf,
  fetchMessages,
  fetchThreads,
  markThreadRead,
  parseAttachment,
  sendFile,
  sendMessage,
} from "@/lib/chat";
import {
  fetchFriendLinks,
  friendsOf,
  incomingRequests,
  isFriend,
  linkWith,
  outgoingRequests,
  removeFriendLink,
  respondFriendRequest,
  sendFriendRequest,
} from "@/lib/friends";
import { fetchChatProfiles, getUserId, profileLabel } from "@/lib/profile";
import { languageError } from "@/lib/language-filter";
import { VoiceCall } from "@/components/VoiceCall";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ChatAttachment } from "@/components/ChatAttachment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";



export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: z.object({ peer: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Messages et appels — Mon Album" },
      {
        name: "description",
        content:
          "Discutez en direct avec les autres lecteurs et lancez un appel vocal depuis votre bibliothèque.",
      },
      { property: "og:title", content: "Messages et appels — Mon Album" },
      {
        property: "og:description",
        content: "Messagerie instantanée et appels vocaux entre membres de Mon Album.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Messages,
});

function Messages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { peer } = Route.useSearch();
  const [me, setMe] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void getUserId().then(setMe);
  }, []);

  const threadsQuery = useQuery({ queryKey: ["threads"], queryFn: fetchThreads });
  const messagesQuery = useQuery({ queryKey: ["messages"], queryFn: fetchMessages });
  const peopleQuery = useQuery({
    queryKey: ["chat-profiles", peopleSearch],
    queryFn: () => fetchChatProfiles(peopleSearch),
  });
  const friendsQuery = useQuery({ queryKey: ["friend-links"], queryFn: fetchFriendLinks });


  useEffect(() => {
    const channel = supabase
      .channel("messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
        queryClient.invalidateQueries({ queryKey: ["threads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["friend-links"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!peer) return;
    void markThreadRead(peer).then(() => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    });
  }, [peer, messagesQuery.data, queryClient]);

  const conversation = useMemo(
    () => (me && peer ? conversationOf(messagesQuery.data ?? [], me, peer) : []),
    [messagesQuery.data, me, peer],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.length]);

  const threads = threadsQuery.data ?? [];
  const links = friendsQuery.data ?? [];
  const friends = friendsOf(links);
  const pendingIn = incomingRequests(links);
  const pendingOut = outgoingRequests(links);
  const people = (peopleQuery.data ?? []).filter((p) => p.id !== me);
  const peerProfile =
    threads.find((t) => t.peerId === peer)?.peer ??
    links.find((l) => l.peerId === peer)?.peer ??
    people.find((p) => p.id === peer) ??
    null;
  const peerName = peerProfile ? profileLabel(peerProfile) : "ce membre";
  const friendly = peer ? isFriend(links, peer) : false;
  const pendingIncoming = peer ? (pendingIn.find((l) => l.peerId === peer) ?? null) : null;
  const pendingOutgoing = peer ? (pendingOut.find((l) => l.peerId === peer) ?? null) : null;

  const addFriend = useMutation({
    mutationFn: (peerId: string) => sendFriendRequest(peerId),
    onSuccess: () => {
      toast.success("Demande d'ami envoyée");
      queryClient.invalidateQueries({ queryKey: ["friend-links"] });
    },
    onError: (error) => toast.error("Demande impossible", { description: error.message }),
  });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondFriendRequest(id, accept),
    onSuccess: (_data, variables) => {
      toast.success(variables.accept ? "Demande acceptée" : "Demande refusée");
      queryClient.invalidateQueries({ queryKey: ["friend-links"] });
    },
    onError: (error) => toast.error("Action impossible", { description: error.message }),
  });

  const cancelLink = useMutation({
    mutationFn: (id: string) => removeFriendLink(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friend-links"] }),
    onError: (error) => toast.error("Action impossible", { description: error.message }),
  });



  const send = useMutation({
    mutationFn: async () => {
      const content = draft.trim();
      if (!content) throw new Error("Écrivez un message.");
      if (content.length > 2000) throw new Error("Message trop long (2000 caractères max).");
      const bad = languageError(content, "Votre message");
      if (bad) throw new Error(bad);
      if (!peer) throw new Error("Choisissez un destinataire.");
      await sendMessage(peer, content);
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (error) => toast.error("Envoi impossible", { description: error.message }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!peer) throw new Error("Choisissez un destinataire.");
      await sendFile(peer, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (error) => toast.error("Fichier non envoyé", { description: error.message }),
  });

  function openPeer(id: string) {
    navigate({ to: "/messages", search: { peer: id } });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 rounded-xl bg-card p-4 shadow-card">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="h-5 w-5 text-primary" />
          Messages
        </h1>

        {threads.length > 0 && (
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li key={thread.peerId}>
                <button
                  type="button"
                  onClick={() => openPeer(thread.peerId)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                    peer === thread.peerId && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {profileLabel(thread.peer)}
                    </span>

                    {thread.unread > 0 && (
                      <span className="rounded-full bg-accent px-2 text-[11px] text-accent-foreground">
                        {thread.unread}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-1 text-xs opacity-70">{thread.last.content}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {pendingIn.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Demandes d'ami
            </p>
            <ul className="space-y-1">
              {pendingIn.map((link) => (
                <li key={link.request.id} className="flex items-center gap-1 rounded-lg px-2 py-1">
                  <span className="flex-1 truncate text-sm">{profileLabel(link.peer)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Accepter"
                    onClick={() => respond.mutate({ id: link.request.id, accept: true })}
                  >
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Refuser"
                    onClick={() => respond.mutate({ id: link.request.id, accept: false })}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {friends.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mes amis
            </p>
            {friends.map((link) => (
              <button
                key={link.request.id}
                type="button"
                onClick={() => openPeer(link.peerId)}
                className={cn(
                  "w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
                  peer === link.peerId && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {profileLabel(link.peer)}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              const first = people[0];
              if (first) openPeer(first.id);
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Trouver un membre (pseudo ou nom)…"
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              aria-label="Rechercher un membre"
            />
          </form>
          {peopleSearch.trim() && people.length === 0 && !peopleQuery.isLoading && (
            <p className="px-1 text-xs text-muted-foreground">Aucun membre trouvé.</p>
          )}
          <ul className="space-y-1">
            {people.slice(0, 8).map((profile) => {
              const link = linkWith(links, profile.id);
              return (
                <li key={profile.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openPeer(profile.id)}
                    className="flex-1 truncate rounded-lg px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    {profileLabel(profile)}
                  </button>
                  {link?.request.status === "accepted" ? (
                    <span className="px-1 text-[11px] text-muted-foreground">Ami</span>
                  ) : link?.request.status === "pending" ? (
                    <span className="px-1 text-[11px] text-muted-foreground">
                      {link.outgoing ? "Envoyée" : "Reçue"}
                    </span>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Envoyer une demande d'ami"
                      onClick={() => addFriend.mutate(profile.id)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

      </aside>

      <section className="flex min-h-[60vh] flex-col rounded-xl bg-card p-4 shadow-card">
        {!peer ? (
          <p className="m-auto text-sm text-muted-foreground">
            Sélectionnez un ami pour discuter ou lancer un appel vocal.
          </p>
        ) : !friendly ? (
          <div className="m-auto max-w-sm space-y-3 text-center">
            <p className="text-sm font-medium">{peerName}</p>
            <p className="text-sm text-muted-foreground">
              {pendingIncoming
                ? "Ce membre vous a envoyé une demande d'ami. Acceptez-la pour discuter et vous appeler."
                : pendingOutgoing
                  ? "Demande d'ami envoyée. Vous pourrez discuter dès qu'elle sera acceptée."
                  : "Vous devez être amis pour échanger des messages ou vous appeler."}
            </p>
            {pendingIncoming ? (
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => respond.mutate({ id: pendingIncoming.request.id, accept: true })}>
                  <Check className="mr-2 h-4 w-4" />
                  Accepter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond.mutate({ id: pendingIncoming.request.id, accept: false })}
                >
                  <X className="mr-2 h-4 w-4" />
                  Refuser
                </Button>
              </div>
            ) : pendingOutgoing ? (
              <Button size="sm" variant="outline" onClick={() => cancelLink.mutate(pendingOutgoing.request.id)}>
                Annuler la demande
              </Button>
            ) : (
              <Button size="sm" onClick={() => addFriend.mutate(peer)} disabled={addFriend.isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                Envoyer une demande d'ami
              </Button>
            )}
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <h2 className="text-sm font-semibold">{peerName}</h2>
              {me && <VoiceCall me={me} peerId={peer} peerName={peerName} />}
            </header>


            <div className="flex-1 space-y-2 overflow-y-auto py-4">
              {conversation.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Aucun message. Dites bonjour !
                </p>
              ) : (
                conversation.map((message) => {
                  const attachment = parseAttachment(message.content);
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        message.sender_id === me
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {attachment ? (
                        <ChatAttachment attachment={attachment} />
                      ) : (
                        message.content
                      )}
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex items-center gap-1 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload.mutate(file);
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Joindre un fichier"
                disabled={upload.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {upload.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <EmojiPicker onSelect={(emoji) => setDraft((d) => `${d}${emoji}`)} />
              <Input
                value={draft}
                maxLength={2000}
                placeholder="Votre message…"
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Message"
              />
              <Button type="submit" size="icon" disabled={send.isPending}>
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>

          </>
        )}
      </section>
    </div>
  );
}
