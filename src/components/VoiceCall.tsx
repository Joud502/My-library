import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { pairChannel } from "@/lib/chat";
import { Button } from "@/components/ui/button";

type CallState = "idle" | "calling" | "ringing" | "in-call";

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

/** Appel vocal 1-à-1 (WebRTC) signalé via les canaux temps réel. */
export function VoiceCall({ me, peerId, peerName }: { me: string; peerId: string; peerName: string }) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingOffer.current = null;
    setMuted(false);
    setState("idle");
  }

  async function createPeer() {
    const pc = new RTCPeerConnection(ICE);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        void audioRef.current.play().catch(() => undefined);
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) send("ice", { candidate: event.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) cleanup();
    };
    pcRef.current = pc;
    return pc;
  }

  function send(event: string, payload: Record<string, unknown>) {
    channelRef.current?.send({ type: "broadcast", event, payload: { from: me, ...payload } });
  }

  useEffect(() => {
    const channel = supabase.channel(pairChannel("call", me, peerId), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        if (payload.from === me) return;
        pendingOffer.current = payload.sdp as RTCSessionDescriptionInit;
        setState("ringing");
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === me || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
        setState("in-call");
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.from === me || !pcRef.current) return;
        try {
          await pcRef.current.addIceCandidate(payload.candidate as RTCIceCandidateInit);
        } catch {
          /* candidat ignoré */
        }
      })
      .on("broadcast", { event: "hangup" }, ({ payload }) => {
        if (payload.from === me) return;
        cleanup();
      })
      .subscribe();

    return () => {
      cleanup();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, peerId]);

  async function startCall() {
    try {
      const pc = await createPeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send("offer", { sdp: offer });
      setState("calling");
    } catch {
      toast.error("Micro indisponible", { description: "Autorisez le microphone pour appeler." });
      cleanup();
    }
  }

  async function acceptCall() {
    if (!pendingOffer.current) return;
    try {
      const pc = await createPeer();
      await pc.setRemoteDescription(pendingOffer.current);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send("answer", { sdp: answer });
      setState("in-call");
    } catch {
      toast.error("Impossible de répondre à l'appel");
      cleanup();
    }
  }

  function hangup() {
    send("hangup", {});
    cleanup();
  }

  function toggleMute() {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} autoPlay className="hidden" />
      {state === "idle" && (
        <Button size="sm" variant="outline" onClick={startCall}>
          <Phone className="mr-2 h-4 w-4" />
          Appel vocal
        </Button>
      )}
      {state === "calling" && (
        <>
          <span className="text-xs text-muted-foreground">Appel de {peerName}…</span>
          <Button size="sm" variant="destructive" onClick={hangup}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </>
      )}
      {state === "ringing" && (
        <>
          <span className="text-xs font-medium text-primary">{peerName} vous appelle</span>
          <Button size="sm" onClick={acceptCall}>
            <Phone className="mr-2 h-4 w-4" />
            Répondre
          </Button>
          <Button size="sm" variant="destructive" onClick={hangup}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </>
      )}
      {state === "in-call" && (
        <>
          <span className="text-xs font-medium text-primary">En appel</span>
          <Button size="sm" variant="outline" onClick={toggleMute}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="destructive" onClick={hangup}>
            <PhoneOff className="mr-2 h-4 w-4" />
            Raccrocher
          </Button>
        </>
      )}
    </div>
  );
}
