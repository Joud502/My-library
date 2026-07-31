import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ShieldAlert,
  Trash2,
  Ban,
  LogOut,
  RefreshCw,
  Search,
  ScrollText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminStatus,
  adminLogin,
  adminLogout,
  adminOverview,
  adminDeleteBook,
  adminBanEmail,
  adminUnbanEmail,
  adminSearchBooks,
  adminLogs,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/qureti")({
  head: () => ({
    meta: [
      { title: "Espace privé" },
      { name: "description", content: "Espace privé." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;
type SearchResult = Awaited<ReturnType<typeof adminSearchBooks>>;
type LogRow = Awaited<ReturnType<typeof adminLogs>>["logs"][number];
type BookRow = Overview["books"][number];

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadBooksCsv(books: BookRow[], emailByUser: Map<string, string>, filename: string) {
  const headers = ["id", "titre", "auteur", "genre", "statut", "notes", "proprietaire", "cree_le"];
  const lines = [
    headers.join(","),
    ...books.map((b) =>
      [
        b.id,
        b.title,
        b.author,
        b.genre,
        b.status,
        b.notes,
        emailByUser.get(b.user_id) ?? b.user_id,
        b.created_at,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}



function AdminPage() {
  const status = useServerFn(adminStatus);
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const overview = useServerFn(adminOverview);

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [banned, setBanned] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);

  useEffect(() => {
    status()
      .then((s) => {
        setAuthed(s.authenticated);
        setBanned(s.banned);
        setLockedFor(s.lockedFor);
      })
      .finally(() => setChecking(false));
  }, [status]);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setInterval(() => setLockedFor((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [lockedFor]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (banned) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl bg-card p-8 text-center shadow-elevated">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre adresse IP a été bloquée.
          </p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <LoginCard
        lockedFor={lockedFor}
        onLocked={setLockedFor}
        onBanned={() => setBanned(true)}
        onSuccess={() => setAuthed(true)}
        login={login}
      />
    );
  }

  return (
    <Dashboard
      overview={overview}
      onLogout={async () => {
        await logout();
        setAuthed(false);
      }}
    />
  );
}

function LoginCard({
  lockedFor,
  onLocked,
  onBanned,
  onSuccess,
  login,
}: {
  lockedFor: number;
  onLocked: (n: number) => void;
  onBanned: () => void;
  onSuccess: () => void;
  login: ReturnType<typeof useServerFn<typeof adminLogin>>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ data: { username, password } });
      if (res.ok) {
        onSuccess();
        return;
      }
      if (res.banned) {
        onBanned();
        return;
      }
      if (res.lockedFor > 0) {
        onLocked(res.lockedFor);
        toast.error("Trop de tentatives", { description: "Accès bloqué 10 minutes." });
      } else {
        toast.error("Identifiants invalides");
      }
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  const minutes = Math.floor(lockedFor / 60);
  const seconds = lockedFor % 60;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-8 shadow-elevated"
      >
        <h1 className="text-xl font-semibold">Espace privé</h1>
        {lockedFor > 0 ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Accès bloqué encore {minutes}:{String(seconds).padStart(2, "0")}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="u">Identifiant</Label>
          <Input
            id="u"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">Mot de passe</Label>
          <Input
            id="p"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || lockedFor > 0}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrer
        </Button>
      </form>
    </main>
  );
}

function Dashboard({
  overview,
  onLogout,
}: {
  overview: ReturnType<typeof useServerFn<typeof adminOverview>>;
  onLogout: () => void;
}) {
  const deleteBook = useServerFn(adminDeleteBook);
  const banEmail = useServerFn(adminBanEmail);
  const unbanEmail = useServerFn(adminUnbanEmail);
  const searchBooks = useServerFn(adminSearchBooks);
  const fetchLogs = useServerFn(adminLogs);

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const res = await fetchLogs({ data: { limit: 100 } });
      setLogs(res.logs);
    } catch {
      toast.error("Journal indisponible");
    } finally {
      setLogsLoading(false);
    }
  }

  async function runSearch() {
    const value = searchEmail.trim();
    if (!value) return;
    setSearching(true);
    try {
      const res = await searchBooks({ data: { email: value } });
      setResult(res);
      if (!res.found) toast.info("Aucun utilisateur avec cet e-mail");
    } catch {
      toast.error("Recherche impossible");
    } finally {
      setSearching(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      setData(await overview());
    } catch {
      toast.error("Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailByUser = new Map((data?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Quitter
          </Button>
        </div>
      </header>

      {loading || !data ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Utilisateurs", data.users.length],
              ["Livres", data.bookCount],
              ["Séries", data.serieCount],
              ["Comptes bannis", data.bans.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Rechercher les livres d'un utilisateur</h2>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-[280px]"
                type="email"
                placeholder="Adresse e-mail de l'utilisateur"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
              />
              <Button onClick={runSearch} disabled={searching}>
                {searching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Rechercher
              </Button>
              {result ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setResult(null);
                    setSearchEmail("");
                  }}
                >
                  Effacer
                </Button>
              ) : null}
            </div>
            {result?.found ? (
              <p className="text-xs text-muted-foreground">
                {result.books.length} livre(s) pour <strong>{result.email}</strong>
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">
                {result?.found ? `Livres de ${result.email}` : "Derniers livres ajoutés"}
              </h2>
              <Button
                variant="outline"
                size="sm"
                disabled={(result?.found ? result.books : data.books).length === 0}
                onClick={() => {
                  const books = result?.found ? result.books : data.books;
                  const suffix = result?.found
                    ? result.email.replace(/[^a-z0-9]+/gi, "-")
                    : "recents";
                  downloadBooksCsv(books, emailByUser, `livres-${suffix}.csv`);
                  toast.success(`${books.length} livre(s) exporté(s)`);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Exporter CSV
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Couverture</th>
                    <th className="p-3">Titre</th>
                    <th className="p-3">Auteur</th>
                    <th className="p-3">Propriétaire</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {(result?.found ? result.books : data.books).map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-3">
                        {(result?.found ? result.covers : data.covers)[b.id] ? (
                          <img
                            src={(result?.found ? result.covers : data.covers)[b.id]}
                            alt={`Couverture de ${b.title}`}
                            className="h-14 w-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">{b.title}</td>
                      <td className="p-3">{b.author}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {emailByUser.get(b.user_id) ?? b.user_id}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await deleteBook({ data: { id: b.id } });
                            toast.success("Livre supprimé");
                            load();
                            loadLogs();
                            if (result?.found) runSearch();
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Utilisateurs</h2>
            <div className="overflow-x-auto rounded-xl bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Nom</th>
                    <th className="p-3">Inscription</th>
                    <th className="p-3">Dernière connexion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.display_name ?? "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Bannissement par e-mail</h2>
            <p className="text-xs text-muted-foreground">
              Le compte est bloqué et ses sessions révoquées sur tous ses appareils et réseaux.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-[240px]"
                type="email"
                placeholder="Adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                className="max-w-[260px]"
                placeholder="Motif (optionnel)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                onClick={async () => {
                  if (!email.trim()) return;
                  try {
                    const res = await banEmail({
                      data: { email: email.trim(), reason: reason.trim() || undefined },
                    });
                    setEmail("");
                    setReason("");
                    toast.success(
                      res.found
                        ? "Compte banni et déconnecté partout"
                        : "E-mail ajouté à la liste noire",
                    );
                    load();
                    loadLogs();
                  } catch {
                    toast.error("Bannissement impossible");
                  }
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                Bannir
              </Button>
            </div>
            <ul className="space-y-2">
              {data.bans.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-lg bg-card p-3 text-sm shadow-card"
                >
                  <span>
                    <strong>{b.email}</strong>
                    {b.reason ? (
                      <span className="text-muted-foreground"> — {b.reason}</span>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await unbanEmail({ data: { id: b.id } });
                      toast.success("Compte débloqué");
                      load();
                      loadLogs();
                    }}
                  >
                    Débloquer
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <ScrollText className="h-5 w-5" />
                Journal d'activité
              </h2>
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualiser
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Détail</th>
                    <th className="p-3">Cible</th>
                    <th className="p-3">Origine</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        {logsLoading ? "Chargement…" : "Aucun événement enregistré."}
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleString("fr-FR")}
                        </td>
                        <td className="p-3 font-medium">{l.action}</td>
                        <td className="p-3">{l.detail ?? "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {l.target_email ?? l.target_id ?? "—"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{l.ip ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
