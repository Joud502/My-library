import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { uploadCover } from "@/lib/library";
import { languageError } from "@/lib/language-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/ajouter-serie")({
  head: () => ({
    meta: [
      { title: "Ajouter une série — Mon Album" },
      {
        name: "description",
        content:
          "Créez une série pour regrouper les tomes et les cycles de votre bibliothèque personnelle.",
      },
      { property: "og:title", content: "Ajouter une série — Mon Album" },
      {
        property: "og:description",
        content: "Regroupez vos livres par série dans Mon Album.",
      },
    ],
  }),
  component: AjouterSerie,
});

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(150),
  author: z.string().trim().max(150).optional(),
  description: z.string().trim().max(1000).optional(),
});

function AjouterSerie() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, author, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const badLanguage =
      languageError(parsed.data.name, "Le nom de la série") ??
      languageError(parsed.data.author ?? "", "Le nom de l'auteur") ??
      languageError(parsed.data.description ?? "", "La description");
    if (badLanguage) {
      toast.error("Contenu refusé", { description: badLanguage });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Session expirée");

      let coverPath: string | null = null;
      if (file) coverPath = await uploadCover(file);

      const { error } = await supabase.from("series").insert({
        user_id: userId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        cover_url: coverPath,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["series"] });
      toast.success("Série ajoutée");
      navigate({ to: "/mon-album" });
    } catch (err) {
      toast.error("Ajout impossible", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Ajouter une série</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Regroupez plusieurs tomes sous un même cycle.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-xl bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="name">Nom de la série *</Label>
          <Input
            id="name"
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serie-cover">Image de couverture</Label>
          <Input
            id="serie-cover"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={4}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter la série
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/mon-album" })}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
