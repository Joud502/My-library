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
import { Button } from "@/components/ui/button";


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

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void getUserId().then((me) => {
      if (!me || cancelled) return;
      meRef.current = me;

      const callChannel = supabase
        .channel(userCallChannel(me))
        .on("broadcast", { event: "ring" }, async ({ payload }) => {
          const from = payload.from as string;
          if (!from || from === me) return;
          const name = await peerName(from);
          const stopRing = startRingTone("incoming");
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

      cleanup = () => {
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
