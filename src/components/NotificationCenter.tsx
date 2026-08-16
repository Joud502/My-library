import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isPeerMuted,
  markThreadRead,
  mutePeer,
  pairChannel,
  parseAttachment,
  userCallChannel,
} from "@/lib/chat";
import { getUserId, profileLabel, type Profile } from "@/lib/profile";
import { startRingTone } from "@/lib/call-sounds";
import { fetchFriendLinks, isFriend, respondFriendRequest } from "@/lib/friends";
import { Button } from "@/components/ui/button";
import {
  closeSystemNotifications,
  notificationsSupported,
  onNotificationAction,
  requestNotificationPermission,
  systemNotify,
  type NotificationData,
} from "@/lib/system-notifications";



async function peerName(id: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, is_public, allow_chat, created_at")
    .eq("id", id)
    .maybeSingle();
  return profileLabel((data as Profile) ?? null);
}

/** Notifications globales : appels entrants et nouveaux messages. */
export function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meRef = useRef<string | null>(null);
  const ringStops = useRef(new Map<string, () => void>());

  const stopRingFor = (peerId: string) => {
    ringStops.current.get(peerId)?.();
    ringStops.current.delete(peerId);
  };

  const hangUp = (peerId: string) => {
    const me = meRef.current;
    if (!me) return;
    const hang = supabase.channel(pairChannel("call", me, peerId));
    hang.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      void hang
        .send({ type: "broadcast", event: "hangup", payload: { from: me } })
        .then(() => setTimeout(() => supabase.removeChannel(hang), 500));
    });
  };

  // Actions déclenchées depuis les boutons des notifications système.
  useEffect(() => {
    const run = async (action: string, data: NotificationData) => {
      const peerId = data.peerId;
      if (!peerId) return;
      if (data.kind === "call") {
        stopRingFor(peerId);
        if (action === "hangup") {
          hangUp(peerId);
          return;
        }
        void navigate({ to: "/messages", search: { peer: peerId } });
        return;
      }
      if (data.kind === "message") {
        if (action === "read") {
          await markThreadRead(peerId);
          queryClient.invalidateQueries({ queryKey: ["threads"] });
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          toast.success("Conversation marquée comme lue.");
          return;
        }
        if (action === "mute") {
          mutePeer(peerId, 60);
          toast.success("Notifications coupées pendant 1 heure.");
          return;
        }
        void navigate({ to: "/messages", search: { peer: peerId } });
        return;
      }
      void navigate({ to: "/messages", search: {} });
    };

    const off = onNotificationAction((action, data) => void run(action, data));

    // Cas « site fermé » : le worker rouvre le site avec l'action en paramètre.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("na");
      const peer = params.get("peer");
      if (action && peer) {
        void run(action, { kind: action === "hangup" ? "call" : "message", peerId: peer });
        params.delete("na");
        const query = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`,
        );
      }
    }

    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, queryClient]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void getUserId().then((me) => {
      if (!me || cancelled) return;
      meRef.current = me;

      // Toute personne connectée doit accepter (ou refuser) les notifications système.
      if (notificationsSupported() && Notification.permission === "default") {
        const askId = toast("Activer les notifications système ?", {
          duration: 60000,
          description: "Recevez les appels et messages même quand l'onglet est en arrière-plan.",
          action: {
            label: "Autoriser",
            onClick: () => {
              void requestNotificationPermission(true).then((p) => {
                if (p === "granted") toast.success("Notifications système activées.");
                else if (p === "denied") toast.error("Notifications bloquées par le navigateur.");
              });
            },
          },
          cancel: { label: "Plus tard", onClick: () => toast.dismiss(askId) },
        });
      }

      const callChannel = supabase
        .channel(userCallChannel(me))
        .on("broadcast", { event: "ring" }, async ({ payload }) => {
          const from = payload.from as string;
          if (!from || from === me) return;
          // Seuls les amis peuvent faire sonner votre appareil.
          if (!isFriend(await fetchFriendLinks(), from)) return;
          const name = await peerName(from);
          const stopRing = startRingTone("incoming");
          ringStops.current.set(from, stopRing);
          const sysCall = systemNotify(`${name} vous appelle`, {
            body: "Appel entrant — répondre ou raccrocher ?",
            tag: `call-${from}`,
            requireInteraction: true,
            actions: [
              { action: "answer", title: "Répondre" },
              { action: "hangup", title: "Raccrocher" },
            ],
            data: { kind: "call", peerId: from, url: `/messages?peer=${from}` },
            onClick: () => {
              stopRing();
              void navigate({ to: "/messages", search: { peer: from } });
            },
          });
          setTimeout(() => {
            sysCall?.close();
            void closeSystemNotifications(`call-${from}`);
            stopRingFor(from);
          }, 30000);

          const id = toast(`${name} vous appelle`, {
            description: "Répondre ou raccrocher ?",
            duration: 30000,
            onDismiss: () => stopRing(),
            onAutoClose: () => stopRing(),
            action: {
              label: "Répondre",
              onClick: () => {
                stopRing();
                void navigate({ to: "/messages", search: { peer: from } });
              },
            },
            cancel: {
              label: "Raccrocher",
              onClick: () => {
                stopRing();
                const hang = supabase.channel(pairChannel("call", me, from));
                hang.subscribe((status) => {
                  if (status !== "SUBSCRIBED") return;
                  void hang
                    .send({ type: "broadcast", event: "hangup", payload: { from: me } })
                    .then(() => setTimeout(() => supabase.removeChannel(hang), 500));
                });
              },
            },
          });
          void id;
        })
        .subscribe();

      const msgChannel = supabase
        .channel("messages-inbox")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${me}` },
          async ({ new: row }) => {
            const message = row as { sender_id: string; content: string };
            if (isPeerMuted(message.sender_id)) return;
            if (!isFriend(await fetchFriendLinks(), message.sender_id)) return;
            if (
              typeof window !== "undefined" &&
              window.location.pathname.startsWith("/messages") &&
              window.location.search.includes(message.sender_id)
            ) {
              return;
            }
            const name = await peerName(message.sender_id);
            const preview = parseAttachment(message.content)
              ? "📎 Pièce jointe"
              : message.content.slice(0, 80);
            systemNotify(`Message de ${name}`, {
              body: preview,
              tag: `msg-${message.sender_id}`,
              onClick: () => void navigate({ to: "/messages", search: { peer: message.sender_id } }),
            });
            toast.custom(

              (id) => (
                <div className="w-[340px] rounded-xl border border-border bg-card p-4 shadow-card">
                  <p className="text-sm font-semibold">Message de {name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        toast.dismiss(id);
                        void navigate({ to: "/messages", search: { peer: message.sender_id } });
                      }}
                    >
                      Répondre
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        mutePeer(message.sender_id, 60);
                        toast.dismiss(id);
                        toast.success(`Notifications de ${name} coupées 1 heure.`);
                      }}
                    >
                      Muet 1 h
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        toast.dismiss(id);
                        await markThreadRead(message.sender_id);
                        queryClient.invalidateQueries({ queryKey: ["threads"] });
                        queryClient.invalidateQueries({ queryKey: ["messages"] });
                      }}
                    >
                      Marquer comme lu
                    </Button>
                  </div>
                </div>
              ),
              { duration: 20000, id: `msg-${message.sender_id}` },
            );

          },
        )
        .subscribe();

      const friendChannel = supabase
        .channel("friend-requests-inbox")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "friend_requests",
            filter: `addressee_id=eq.${me}`,
          },
          async ({ new: row }) => {
            const request = row as { id: string; requester_id: string };
            const name = await peerName(request.requester_id);
            queryClient.invalidateQueries({ queryKey: ["friend-links"] });
            systemNotify(`${name} veut devenir votre ami`, {
              body: "Ouvrez la messagerie pour accepter ou refuser.",
              tag: `friend-${request.id}`,
              onClick: () => void navigate({ to: "/messages", search: {} }),
            });
            toast(`${name} veut devenir votre ami`, {

              duration: 30000,
              action: {
                label: "Accepter",
                onClick: async () => {
                  await respondFriendRequest(request.id, true);
                  queryClient.invalidateQueries({ queryKey: ["friend-links"] });
                  toast.success(`Vous êtes maintenant amis avec ${name}.`);
                },
              },
              cancel: {
                label: "Refuser",
                onClick: async () => {
                  await respondFriendRequest(request.id, false);
                  queryClient.invalidateQueries({ queryKey: ["friend-links"] });
                },
              },
            });
          },
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(friendChannel);
        supabase.removeChannel(callChannel);
        supabase.removeChannel(msgChannel);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [navigate, queryClient]);

  return null;
}
