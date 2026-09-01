import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Layers, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { findFreeRead } from "@/lib/book-lookup";
import { useLanguage } from "@/lib/i18n";
import {
  deleteBook,
  deleteSerie,
  fetchBooks,
  fetchOwnerCounts,
  fetchSeries,
  titleKey,
  STATUS_LABELS,
  type Book,
} from "@/lib/library";
import { CoverImage } from "@/components/CoverImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/mon-album")({
  head: () => ({
    meta: [
      { title: "Mon album — votre bibliothèque personnelle" },
      {
        name: "description",
        content:
          "Consultez, triez et filtrez tous les livres et séries de votre bibliothèque personnelle.",
      },
      { property: "og:title", content: "Mon album — bibliothèque personnelle" },
      {
        property: "og:description",
        content: "Tous vos livres et séries réunis, avec tri et recherche.",
      },
    ],
  }),
  component: MonAlbum,
});

type SortKey = "recent" | "title" | "author" | "year" | "rating";

function sortBooks(books: Book[], key: SortKey) {
  const copy = [...books];
  switch (key) {
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    case "author":
      return copy.sort((a, b) => a.author.localeCompare(b.author, "fr"));
    case "year":
      return copy.sort((a, b) => (b.published_year ?? 0) - (a.published_year ?? 0));
    case "rating":
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    default:
      return copy;
  }
}

function MonAlbum() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [status, setStatus] = useState("tous");
  const [serieFilter, setSerieFilter] = useState("toutes");

  const booksQuery = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const seriesQuery = useQuery({ queryKey: ["series"], queryFn: fetchSeries });
  const ownersQuery = useQuery({ queryKey: ["owner-counts"], queryFn: fetchOwnerCounts });
  const othersFor = (book: Book) =>
    Math.max((ownersQuery.data?.[titleKey(book.title, book.author)] ?? 1) - 1, 0);

  const { t } = useLanguage();
  const [reading, setReading] = useState<string | null>(null);

  async function openFreeRead(book: Book, mode: "read" | "download") {
    setReading(book.id);
    const toastId = toast.loading(t("book.searching"));
    try {
      const found = await findFreeRead(book.title, book.author);
      const url = mode === "read" ? (found?.readUrl ?? found?.downloadUrl) : (found?.downloadUrl ?? found?.readUrl);
      if (!url) {
        toast.error(t("book.none"), { id: toastId });
        return;
      }
      toast.success(mode === "read" ? t("book.opened") : t("book.downloading"), { id: toastId });
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      if (mode === "download" && found?.fileName) a.download = found.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error(t("book.none"), { id: toastId });
    } finally {
      setReading(null);
    }
  }

  const removeBook = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      toast.success("Livre supprimé");
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const removeSerie = useMutation({
    mutationFn: deleteSerie,
    onSuccess: () => {
      toast.success("Série supprimée");
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const series = seriesQuery.data ?? [];
  const serieName = (id: string | null) => series.find((s) => s.id === id)?.name ?? null;

  const visibleBooks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (booksQuery.data ?? []).filter((book) => {
      const matchTerm =
        !term ||
        book.title.toLowerCase().includes(term) ||
        book.author.toLowerCase().includes(term) ||
        (book.genre ?? "").toLowerCase().includes(term);
      const matchStatus = status === "tous" || book.status === status;
      const matchSerie = serieFilter === "toutes" || book.series_id === serieFilter;
      return matchTerm && matchStatus && matchSerie;
    });
    return sortBooks(filtered, sort);
  }, [booksQuery.data, search, sort, status, serieFilter]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Mon album</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {booksQuery.data?.length ?? 0} livre(s) · {series.length} série(s)
        </p>
      </section>

      <section className="grid gap-3 rounded-xl bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un titre, un auteur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher dans la bibliothèque"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger aria-label="Trier par">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récents</SelectItem>
            <SelectItem value="title">Titre (A→Z)</SelectItem>
            <SelectItem value="author">Auteur (A→Z)</SelectItem>
            <SelectItem value="year">Année de parution</SelectItem>
            <SelectItem value="rating">Note</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            <SelectItem value="a_lire">À lire</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="lu">Lu</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serieFilter} onValueChange={setSerieFilter}>
          <SelectTrigger aria-label="Filtrer par série">
            <SelectValue placeholder="Série" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes les séries</SelectItem>
            {series.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section>
        {booksQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement de votre album…</p>
        ) : visibleBooks.length === 0 ? (
          <div className="rounded-xl bg-card p-10 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Aucun livre pour le moment. Commencez votre collection !
            </p>
            <Button asChild className="mt-4">
              <Link to="/ajouter-livre">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un livre
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleBooks.map((book) => (
              <li
                key={book.id}
                className="group overflow-hidden rounded-xl bg-card shadow-card transition-shadow hover:shadow-elevated"
              >
                <CoverImage path={book.cover_url} alt={book.title} className="h-48 w-full" />
                <div className="space-y-1 p-4">
                  <h2 className="line-clamp-2 text-sm font-semibold">{book.title}</h2>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  <div className="flex flex-wrap gap-1 pt-2 text-[11px] text-secondary-foreground">
                    <span className="rounded-full bg-secondary px-2 py-0.5">
                      {STATUS_LABELS[book.status] ?? book.status}
                    </span>
                    {book.genre && (
                      <span className="rounded-full bg-secondary px-2 py-0.5">{book.genre}</span>
                    )}
                    {book.published_year && (
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {book.published_year}
                      </span>
                    )}
                    {serieName(book.series_id) && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                        {serieName(book.series_id)}
                      </span>
                    )}
                    {book.rating ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {book.rating}/5
                      </span>
                    ) : null}
                  </div>
                  <p className="flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    {othersFor(book) === 0
                      ? "Personne d'autre n'a ce livre"
                      : othersFor(book) === 1
                        ? "1 personne a le même livre que vous"
                        : `${othersFor(book)} personnes ont le même livre que vous`}
                  </p>
                  {book.notes && (
                    <p className="line-clamp-2 pt-2 text-xs text-muted-foreground">{book.notes}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-destructive hover:text-destructive"
                    onClick={() => removeBook.mutate(book.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Layers className="h-5 w-5 text-primary" />
          Mes séries
        </h2>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune série.{" "}
            <Link to="/ajouter-serie" className="font-medium text-primary hover:underline">
              Ajouter une série
            </Link>
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((serie) => (
              <li key={serie.id} className="flex gap-3 rounded-xl bg-card p-3 shadow-card">
                <CoverImage
                  path={serie.cover_url}
                  alt={serie.name}
                  className="h-24 w-20 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{serie.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {(booksQuery.data ?? []).filter((b) => b.series_id === serie.id).length}{" "}
                    livre(s)
                  </p>
                  {serie.description && (
                    <p className="line-clamp-2 pt-1 text-xs text-muted-foreground">
                      {serie.description}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 px-0 text-destructive hover:text-destructive"
                    onClick={() => removeSerie.mutate(serie.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
