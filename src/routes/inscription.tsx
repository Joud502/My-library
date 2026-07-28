import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookMarked, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/inscription")({
  head: () => ({
    meta: [
      { title: "Créer un compte — Mon Album" },
      {
        name: "description",
        content:
          "Créez votre compte Mon Album et commencez à cataloguer vos livres et vos séries en quelques secondes.",
      },
      { property: "og:title", content: "Créer un compte — Mon Album" },
      {
        property: "og:description",
        content: "Rejoignez Mon Album pour gérer votre bibliothèque personnelle.",
      },
    ],
  }),
  component: SignupPage,
});

const schema = z.object({
  displayName: z.string().trim().min(1, "Indiquez un nom").max(80),
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  password: z.string().min(6, "6 caractères minimum").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirmation`,
        data: { display_name: parsed.data.displayName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Inscription impossible", { description: error.message });
      return;
    }
    if (data.session) {
      toast.success("Compte créé, bienvenue !");
      navigate({ to: "/mon-album", replace: true });
    } else {
      toast.success("Compte créé", {
        description: "Vérifiez votre boîte mail pour confirmer votre adresse.",
      });
      navigate({ to: "/", replace: true });
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Inscription Google impossible");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/mon-album", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-elevated">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-card">
            <BookMarked className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Créer un compte</h1>
          <p className="text-sm text-muted-foreground">
            Déjà membre ?{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              required
              maxLength={80}
              placeholder="Camille Dupont"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
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
              autoComplete="new-password"
              placeholder="6 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            S'inscrire
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou s'inscrire avec
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Google
        </Button>
      </div>
    </main>
  );
}
