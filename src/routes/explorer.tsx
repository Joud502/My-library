import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { fetchPublicProfiles } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/explorer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Explorer les albums publics — Mon Album" },
      {
        name: "description",
        content:
          "Parcourez les bibliothèques partagées par les membres, découvrez leurs livres et discutez avec eux.",
      },
      { property: "og:title", content: "Explorer les albums publics — Mon Album" },
      {
        property: "og:description",
        content: "Découvrez les albums de lecture publics des membres de Mon Album.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explorer,
});

function Explorer() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["public-profiles", search],
    queryFn: () => fetchPublicProfiles(search),
  });

  return (
    <main className="min-h-screen bg-gradient-surface">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Explorer les albums</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les membres qui ont rendu leur album public apparaissent ici.
          </p>
        </header>

        <form className="relative" onSubmit={(e) => e.preventDefault()}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un pseudo ou un nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un membre"
          />
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
            {search.trim()
              ? "Aucun membre public ne correspond à cette recherche."
              : "Aucun album public pour l'instant. Activez « Album public » dans vos paramètres pour apparaître ici."}
          </p>

        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(data ?? []).map((profile) => (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">@{profile.username}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.display_name ?? "Membre"}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/u/$username" params={{ username: profile.username ?? "" }}>
                    <Users className="mr-2 h-4 w-4" />
                    Voir l'album
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
