import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, Check, Copy, Eye, EyeOff, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listMutedPeers, unmutePeer } from "@/lib/chat";
import {
  fetchMyProfile,
  isUsernameAvailable,
  profileLabel,
  updateMyProfile,
  type Profile,
} from "@/lib/profile";
import { languageError } from "@/lib/language-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres du profil — Mon Album" },
      {
        name: "description",
        content:
          "Choisissez votre pseudo, rendez votre album public ou masqué et gérez la messagerie entre membres.",
      },
      { property: "og:title", content: "Paramètres du profil — Mon Album" },
      {
        property: "og:description",
        content: "Pseudo unique, album public ou privé, messagerie : tout se règle ici.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Parametres,
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, "3 caractères minimum")
  .max(24, "24 caractères maximum")
  .regex(/^[a-zA-Z0-9_.]+$/, "Lettres, chiffres, _ et . uniquement");

function Parametres() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: fetchMyProfile });
  const [username, setUsername] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [allowChat, setAllowChat] = useState(true);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    setUsername(profileQuery.data.username ?? "");
    setIsPublic(profileQuery.data.is_public);
    setAllowChat(profileQuery.data.allow_chat);
  }, [profileQuery.data]);

  useEffect(() => {
    const value = username.trim();
    if (!value || value === (profileQuery.data?.username ?? "")) {
      setAvailable(null);
      return;
    }
    if (!usernameSchema.safeParse(value).success || languageError(value, "Le pseudo")) {
      setAvailable(false);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      setAvailable(await isUsernameAvailable(value));
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [username, profileQuery.data?.username]);

  const save = useMutation({
    mutationFn: async () => {
      const value = username.trim();
      const parsed = usernameSchema.safeParse(value);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const bad = languageError(value, "Le pseudo");
      if (bad) throw new Error(bad);
      if (!(await isUsernameAvailable(value))) throw new Error("Ce pseudo est déjà utilisé.");
      await updateMyProfile({ username: value, is_public: isPublic, allow_chat: allowChat });
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (error) => toast.error("Enregistrement impossible", { description: error.message }),
  });

  const publicUrl =
    typeof window !== "undefined" && profileQuery.data?.username
      ? `${window.location.origin}/u/${profileQuery.data.username}`
      : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre pseudo, la visibilité de votre album et la messagerie entre membres.
        </p>
      </div>

      <section className="space-y-5 rounded-xl bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="username">Pseudo public</Label>
          <Input
            id="username"
            value={username}
            maxLength={24}
            placeholder="camille_lit"
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {checking ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vérification…
              </>
            ) : available === true ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" /> Pseudo disponible
              </>
            ) : available === false ? (
              <span className="text-destructive">Pseudo indisponible ou non conforme</span>
            ) : (
              "Il identifie votre album public : lettres, chiffres, _ et . (3 à 24 caractères)."
            )}
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg bg-secondary/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="is-public" className="flex items-center gap-2">
              {isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Album visible par tout le monde
            </Label>
            <p className="text-xs text-muted-foreground">
              Désactivé, vos livres et séries restent visibles uniquement par vous.
            </p>
          </div>
          <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg bg-secondary/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="allow-chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Accepter les messages et les appels
            </Label>
            <p className="text-xs text-muted-foreground">
              Les autres membres peuvent vous écrire et vous appeler en vocal.
            </p>
          </div>
          <Switch id="allow-chat" checked={allowChat} onCheckedChange={setAllowChat} />
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>

        {publicUrl && profileQuery.data?.is_public && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-xs">
            <span className="truncate text-muted-foreground">{publicUrl}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl);
                toast.success("Lien copié");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>

      <MutedPeers />
    </div>
  );
}

/** Membres dont les notifications sont coupées temporairement. */
function MutedPeers() {
  const [muted, setMuted] = useState(listMutedPeers());
  const peersQuery = useQuery({
    queryKey: ["muted-peer-profiles", muted.map((m) => m.peerId).join(",")],
    queryFn: async () => {
      if (!muted.length) return [] as Profile[];
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_public, allow_chat, created_at")
        .in(
          "id",
          muted.map((m) => m.peerId),
        );
      return (data ?? []) as Profile[];
    },
  });

  if (!muted.length) return null;

  return (
    <section className="mt-6 space-y-4 rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center gap-2">
        <BellOff className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Membres en sourdine</h2>
      </div>
      <ul className="space-y-2">
        {muted.map((entry) => {
          const peer = peersQuery.data?.find((p) => p.id === entry.peerId) ?? null;
          return (
            <li
              key={entry.peerId}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <span>
                {profileLabel(peer)}
                <span className="block text-xs text-muted-foreground">
                  Jusqu'à {new Date(entry.until).toLocaleTimeString("fr-FR")}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  unmutePeer(entry.peerId);
                  setMuted(listMutedPeers());
                  toast.success("Notifications réactivées.");
                }}
              >
                Réactiver
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
