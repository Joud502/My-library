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
      return { ok: false as const, banned: false, lockedFor };
    }

    await clearFailures(ip);
    const session = await useSession<{ admin?: boolean }>(sessionConfig());
    await session.update({ admin: true });
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

  const [{ data: books }, { data: series }, { data: profiles }, { data: bans }] =
    await Promise.all([
      supabaseAdmin
        .from("books")
        .select("id, user_id, title, author, cover_url, genre, status, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("series")
        .select("id, user_id, name, description, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
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

  const covers: Record<string, string> = {};
  for (const b of books ?? []) {
    if (b.cover_url && !b.cover_url.startsWith("http")) {
      const { data } = await supabaseAdmin.storage
        .from("covers")
        .createSignedUrl(b.cover_url, 3600);
      if (data?.signedUrl) covers[b.id] = data.signedUrl;
    } else if (b.cover_url) {
      covers[b.id] = b.cover_url;
    }
  }

  return { books: books ?? [], series: series ?? [], users, bans: bans ?? [], covers };
});

export const adminDeleteBook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("books").delete().eq("id", data.id);
    if (error) throw new Error("Suppression impossible");
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
    return { ok: true as const };
  });
