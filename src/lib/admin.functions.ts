import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdminSession, getClientIp, getLockRemainingSeconds, isIpBanned } = await import(
    "@/lib/admin.server"
  );
  const ip = getClientIp();
  return {
    authenticated: await isAdminSession(),
    banned: await isIpBanned(ip),
    lockedFor: await getLockRemainingSeconds(ip),
  };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ username: z.string().trim().max(100), password: z.string().max(200) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const {
      getClientIp,
      getLockRemainingSeconds,
      isIpBanned,
      registerFailure,
      clearFailures,
      safeEqual,
      sessionConfig,
    } = await import("@/lib/admin.server");
    const { useSession } = await import("@tanstack/react-start/server");

    const ip = getClientIp();
    if (await isIpBanned(ip)) return { ok: false as const, banned: true, lockedFor: 0 };

    const locked = await getLockRemainingSeconds(ip);
    if (locked > 0) return { ok: false as const, banned: false, lockedFor: locked };

    const expectedUser = process.env.ADMIN_USERNAME ?? "";
    const expectedPass = process.env.ADMIN_PASSWORD ?? "";
    const valid =
      expectedUser.length > 0 &&
      expectedPass.length > 0 &&
      safeEqual(data.username, expectedUser) &&
      safeEqual(data.password, expectedPass);

    if (!valid) {
      const lockedFor = await registerFailure(ip);
      const { logAdmin } = await import("@/lib/admin.server");
      await logAdmin("admin.login.echec", {
        detail: lockedFor > 0 ? "3 échecs — accès bloqué 10 minutes" : "Mot de passe invalide",
      });
      return { ok: false as const, banned: false, lockedFor };
    }

    await clearFailures(ip);
    const session = await useSession<{ admin?: boolean }>(sessionConfig());
    await session.update({ admin: true });
    const { logAdmin } = await import("@/lib/admin.server");
    await logAdmin("admin.login.succes", { detail: "Connexion à l'espace admin" });
    return { ok: true as const, banned: false, lockedFor: 0 };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { sessionConfig } = await import("@/lib/admin.server");
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<{ admin?: boolean }>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const adminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: books }, { count: bookCount }, { count: serieCount }, { data: profiles }, { data: bans }] =
    await Promise.all([
      supabaseAdmin
        .from("books")
        .select("id, user_id, title, author, cover_url, genre, status, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin.from("books").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("series").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id, display_name, created_at"),
      supabaseAdmin
        .from("banned_emails")
        .select("id, email, user_id, reason, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const users = (userList?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "—",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    display_name: profiles?.find((p) => p.id === u.id)?.display_name ?? null,
  }));

  const { signCovers } = await import("@/lib/admin.server");
  const covers = await signCovers(books ?? []);

  return {
    books: books ?? [],
    bookCount: bookCount ?? 0,
    serieCount: serieCount ?? 0,
    users,
    bans: bans ?? [],
    covers,
  };
});

export const adminDeleteBook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: book } = await supabaseAdmin
      .from("books")
      .select("title, user_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("books").delete().eq("id", data.id);
    if (error) throw new Error("Suppression impossible");
    const { logAdmin } = await import("@/lib/admin.server");
    await logAdmin("livre.supprime", {
      detail: book?.title ? `« ${book.title} »` : undefined,
      targetId: data.id,
    });
    return { ok: true as const };
  });

export const adminBanEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const target = (userList?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);

    const { error } = await supabaseAdmin
      .from("banned_emails")
      .insert({ email, user_id: target?.id ?? null, reason: data.reason ?? null });
    if (error && error.code !== "23505") throw new Error("Bannissement impossible");

    if (target) {
      // Révoque immédiatement toutes les sessions (téléphone, PC, tout réseau).
      await supabaseAdmin.auth.admin.updateUserById(target.id, { ban_duration: "876000h" });
      await supabaseAdmin.auth.admin.signOut(target.id, "global").catch(() => {});
    }
    const { logAdmin } = await import("@/lib/admin.server");
    await logAdmin("compte.banni", { detail: data.reason ?? undefined, targetEmail: email });
    return { ok: true as const, found: !!target };
  });

export const adminUnbanEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("banned_emails")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.user_id) {
      await supabaseAdmin.auth.admin.updateUserById(row.user_id, { ban_duration: "none" });
    }
    await supabaseAdmin.from("banned_emails").delete().eq("id", data.id);
    const { logAdmin } = await import("@/lib/admin.server");
    await logAdmin("compte.debloque", { targetId: data.id });
    return { ok: true as const };
  });

export const adminSearchBooks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().min(1).max(255) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, logAdmin, signCovers } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const needle = data.email.toLowerCase();
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const target = (userList?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === needle,
    );
    if (!target) return { found: false as const, email: data.email, books: [], covers: {} };

    const { data: books } = await supabaseAdmin
      .from("books")
      .select("id, user_id, title, author, cover_url, genre, status, notes, created_at")
      .eq("user_id", target.id)
      .order("created_at", { ascending: false })
      .limit(200);

    await logAdmin("recherche.utilisateur", {
      detail: `${books?.length ?? 0} livre(s)`,
      targetEmail: target.email ?? undefined,
    });

    return {
      found: true as const,
      email: target.email ?? data.email,
      books: books ?? [],
      covers: await signCovers(books ?? []),
    };
  });

export const adminLogs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: logs } = await supabaseAdmin
      .from("admin_logs")
      .select("id, action, detail, target_email, target_id, ip, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    return { logs: logs ?? [] };
  });

export const adminExecSql = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(5000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, logAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const started = Date.now();
    const { data: result, error } = await (supabaseAdmin as any).rpc("admin_exec_sql", {
      query: data.query,
    });

    await logAdmin("terminal.sql", {
      detail: `${data.query.slice(0, 180)}${error ? ` — ERREUR: ${error.message}` : ""}`,
    });

    if (error) {
      return { ok: false as const, error: error.message, ms: Date.now() - started };
    }
    return { ok: true as const, resultJson: JSON.stringify(result ?? null), ms: Date.now() - started };
  });
