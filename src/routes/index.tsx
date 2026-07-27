import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookMarked, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Connexion — Mon Album, bibliothèque personnelle" },
      {
        name: "description",
        content:
          "Connectez-vous à Mon Album pour retrouver votre bibliothèque personnelle : vos livres, vos séries et vos lectures en cours.",
      },
      { property: "og:title", content: "Connexion — Mon Album" },
      {
        property: "og:description",
        content: "Accédez à votre bibliothèque personnelle de livres et de séries.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/mon-album", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Connexion impossible", { description: error.message });
      return;
    }
    toast.success("Bon retour parmi vos livres !");
    navigate({ to: "/mon-album", replace: true });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Connexion Google impossible");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/mon-album", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elevated">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-card">
            <BookMarked className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Mon Album</h1>
          <p className="text-center text-sm text-muted-foreground">
            Votre bibliothèque personnelle, toujours à portée de main.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Se connecter
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou continuer avec
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
