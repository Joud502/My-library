import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookMarked, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/confirmation")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirmation du compte — Mon Album" },
      {
        name: "description",
        content:
          "Validation de votre adresse e-mail : vous êtes connecté automatiquement à votre album personnel.",
      },
      { property: "og:title", content: "Confirmation du compte — Mon Album" },
      {
        property: "og:description",
        content: "Validation de votre adresse e-mail et connexion automatique à Mon Album.",
      },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      const errorDescription =
        url.searchParams.get("error_description") ?? hash.get("error_description");
      if (errorDescription) {
        if (!cancelled) setError(errorDescription);
        return;
      }

      // 1. Lien avec token_hash (flux de vérification par e-mail)
      const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
      const type = (url.searchParams.get("type") ?? "signup") as
        | "signup"
        | "magiclink"
        | "email"
        | "recovery"
        | "invite"
        | "email_change";
      if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (otpError) {
          if (!cancelled) setError(otpError.message);
          return;
        }
      } else {
        // 2. Lien PKCE avec ?code=
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) setError(exchangeError.message);
            return;
          }
        } else {
          // 3. Lien avec tokens dans le fragment (#access_token=...)
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              if (!cancelled) setError(sessionError.message);
              return;
            }
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setError("Ce lien de confirmation est invalide ou a expiré.");
        return;
      }

      window.history.replaceState({}, "", "/confirmation");
      toast.success("Compte confirmé, bienvenue !");
      navigate({ to: "/mon-album", replace: true });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-elevated">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-card">
          <BookMarked className="h-7 w-7" />
        </div>
        {error ? (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Confirmation impossible</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6 w-full" onClick={() => navigate({ to: "/" })}>
              Retour à la connexion
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Connexion en cours…</h1>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Nous ouvrons votre album.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
