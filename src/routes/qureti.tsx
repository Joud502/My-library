import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, Trash2, Ban, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  adminStatus,
  adminLogin,
  adminLogout,
  adminOverview,
  adminDeleteBook,
  adminBanEmail,
  adminUnbanEmail,
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
  const banIp = useServerFn(adminBanIp);
  const unbanIp = useServerFn(adminUnbanIp);

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");

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
              ["Livres", data.books.length],
              ["Séries", data.series.length],
              ["IP bannies", data.bans.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Livres</h2>
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
                  {data.books.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-3">
                        {data.covers[b.id] ? (
                          <img
                            src={data.covers[b.id]}
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
            <h2 className="text-lg font-medium">Bannissement d'IP</h2>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-[200px]"
                placeholder="Adresse IP"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
              />
              <Input
                className="max-w-[260px]"
                placeholder="Motif (optionnel)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                onClick={async () => {
                  if (!ip.trim()) return;
                  await banIp({ data: { ip: ip.trim(), reason: reason.trim() || undefined } });
                  setIp("");
                  setReason("");
                  toast.success("IP bannie");
                  load();
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
                    <strong>{b.ip}</strong>
                    {b.reason ? (
                      <span className="text-muted-foreground"> — {b.reason}</span>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await unbanIp({ data: { id: b.id } });
                      toast.success("IP débloquée");
                      load();
                    }}
                  >
                    Débloquer
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
