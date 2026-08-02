import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Users } from "lucide-react";
import { fetchPublicAlbum } from "@/lib/profile";
import { STATUS_LABELS } from "@/lib/library";
import { CoverImage } from "@/components/CoverImage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/u/$username")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Album de ${params.username} — Mon Album` },
      {
        name: "description",
        content: `Découvrez les livres et les séries partagés publiquement par ${params.username} sur Mon Album.`,
      },
      { property: "og:title", content: `Album de ${params.username} — Mon Album` },
      {
        property: "og:description",
        content: `La bibliothèque publique de ${params.username} : livres, séries et lectures en cours.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicAlbum,
});

function PublicAlbum() {
  const { username } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["public-album", username],
    queryFn: () => fetchPublicAlbum(username),
  });

  if (isLoading) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Chargement de l'album…</p>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Album introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce pseudo n'existe pas ou son album est masqué par son propriétaire.
        </p>
        <Button asChild className="mt-6">
          <Link to="/explorer">Explorer les albums publics</Link>
        </Button>
      </main>
    );
  }

  const { profile, books, series } = data;
  const serieName = (id: string | null) => series.find((s) => s.id === id)?.name ?? null;

  return (
    <main className="min-h-screen bg-gradient-surface">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header className="rounded-xl bg-card p-6 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Album public</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">@{profile.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.display_name ? `${profile.display_name} · ` : ""}
            {books.length} livre(s) · {series.length} série(s)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/explorer">
                <Users className="mr-2 h-4 w-4" />
                Autres albums
              </Link>
            </Button>
            {profile.allow_chat && (
              <Button asChild size="sm">
                <Link to="/messages" search={{ peer: profile.id }}>
                  Écrire à @{profile.username}
                </Link>
              </Button>
            )}
          </div>
        </header>

        {books.length === 0 ? (
          <p className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
            Cet album ne contient encore aucun livre.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((book) => (
              <li key={book.id} className="overflow-hidden rounded-xl bg-card shadow-card">
                <CoverImage path={book.cover_url} alt={book.title} className="h-48 w-full" />
                <div className="space-y-1 p-4">
                  <h2 className="line-clamp-2 text-sm font-semibold">{book.title}</h2>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  <div className="flex flex-wrap gap-1 pt-2 text-[11px] text-secondary-foreground">
                    <span className="rounded-full bg-secondary px-2 py-0.5">
                      {STATUS_LABELS[book.status] ?? book.status}
                    </span>
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
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {series.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BookOpen className="h-5 w-5 text-primary" />
              Séries
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {series.map((serie) => (
                <li key={serie.id} className="rounded-xl bg-card p-4 shadow-card">
                  <p className="font-medium">{serie.name}</p>
                  {serie.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {serie.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
