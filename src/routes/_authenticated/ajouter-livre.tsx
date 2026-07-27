import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchSeries, uploadCover } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/ajouter-livre")({
  head: () => ({
    meta: [
      { title: "Ajouter un livre — Mon Album" },
      {
        name: "description",
        content:
          "Ajoutez un livre à votre bibliothèque : titre, auteur, couverture et informations optionnelles.",
      },
      { property: "og:title", content: "Ajouter un livre — Mon Album" },
      {
        property: "og:description",
        content: "Enregistrez un nouveau livre dans votre bibliothèque personnelle.",
      },
    ],
  }),
  component: AjouterLivre,
});

const schema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(200),
  author: z.string().trim().min(1, "L'auteur est obligatoire").max(150),
  genre: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function AjouterLivre() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const seriesQuery = useQuery({ queryKey: ["series"], queryFn: fetchSeries });

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [pages, setPages] = useState("");
  const [rating, setRating] = useState("");
  const [status, setStatus] = useState("a_lire");
  const [serieId, setSerieId] = useState("aucune");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ title, author, genre, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Session expirée");

      let coverPath: string | null = null;
      if (file) coverPath = await uploadCover(file);

      const { error } = await supabase.from("books").insert({
        user_id: userId,
        title: parsed.data.title,
        author: parsed.data.author,
        genre: parsed.data.genre || null,
        published_year: year ? Number(year) : null,
        pages: pages ? Number(pages) : null,
        rating: rating ? Number(rating) : null,
        status,
        notes: parsed.data.notes || null,
        series_id: serieId === "aucune" ? null : serieId,
        cover_url: coverPath,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Livre ajouté à votre album");
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
      <h1 className="text-3xl font-semibold tracking-tight">Ajouter un livre</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Le titre et l'auteur suffisent, le reste est optionnel.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-xl bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="title">Titre *</Label>
          <Input
            id="title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author">Auteur *</Label>
          <Input
            id="author"
            required
            maxLength={150}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cover">Image de couverture</Label>
          <Input
            id="cover"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <Input
              id="genre"
              maxLength={80}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Année de parution</Label>
            <Input
              id="year"
              type="number"
              min={0}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pages">Nombre de pages</Label>
            <Input
              id="pages"
              type="number"
              min={0}
              max={100000}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Note (sur 5)</Label>
            <Input
              id="rating"
              type="number"
              min={0}
              max={5}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Statut de lecture</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_lire">À lire</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="lu">Lu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Série</Label>
            <Select value={serieId} onValueChange={setSerieId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aucune">Aucune</SelectItem>
                {(seriesQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Commentaire</Label>
          <Textarea
            id="notes"
            maxLength={1000}
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter le livre
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/mon-album" })}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
