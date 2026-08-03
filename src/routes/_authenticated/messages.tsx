import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationOf,
  fetchMessages,
  fetchThreads,
  markThreadRead,
  sendMessage,
} from "@/lib/chat";
import { fetchChatProfiles, getUserId, profileLabel } from "@/lib/profile";
import { languageError } from "@/lib/language-filter";
import { VoiceCall } from "@/components/VoiceCall";
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

  useEffect(() => {
    void getUserId().then(setMe);
  }, []);

  const threadsQuery = useQuery({ queryKey: ["threads"], queryFn: fetchThreads });
  const messagesQuery = useQuery({ queryKey: ["messages"], queryFn: fetchMessages });
  const peopleQuery = useQuery({
    queryKey: ["chat-profiles", peopleSearch],
    queryFn: () => fetchChatProfiles(peopleSearch),
  });


  useEffect(() => {
    const channel = supabase
      .channel("messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
        queryClient.invalidateQueries({ queryKey: ["threads"] });
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
  const people = (peopleQuery.data ?? []).filter((p) => p.id !== me);
  const peerProfile =
    threads.find((t) => t.peerId === peer)?.peer ?? people.find((p) => p.id === peer) ?? null;
  const peerName = peerProfile ? profileLabel(peerProfile) : "ce membre";


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
                      {thread.peer?.username ? `@${thread.peer.username}` : "Membre"}
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

        <div className="space-y-2 border-t border-border pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Trouver un pseudo…"
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              aria-label="Rechercher un membre"
            />
          </div>
          <ul className="space-y-1">
            {people.slice(0, 8).map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => openPeer(profile.id)}
                  className="w-full truncate rounded-lg px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
                >
                  @{profile.username}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="flex min-h-[60vh] flex-col rounded-xl bg-card p-4 shadow-card">
        {!peer ? (
          <p className="m-auto text-sm text-muted-foreground">
            Sélectionnez un membre pour discuter ou lancer un appel vocal.
          </p>
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
                conversation.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      message.sender_id === me
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex gap-2 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
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
