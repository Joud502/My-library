// Server-only helpers for the /qureti back-office.
import { useSession, getRequestHeader } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type AdminSession = { admin?: boolean };

export function sessionConfig() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password) throw new Error("ADMIN_SESSION_SECRET is not set");
  return {
    password,
    name: "qureti-admin",
    maxAge: 60 * 60 * 4,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export function getClientIp(): string {
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const candidate =
    forwarded.split(",")[0]?.trim() ||
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    "unknown";
  // Keep it bounded so a forged header can never blow up storage or the UI.
  return candidate.slice(0, 45);
}

/** Constant-time comparison that never leaks length through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export async function isAdminSession(): Promise<boolean> {
  const session = await useSession<AdminSession>(sessionConfig());
  return session.data.admin === true;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSession())) throw new Error("Non autorisé");
}

export async function isIpBanned(ip: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ip_bans")
    .select("ip")
    .eq("ip", ip)
    .maybeSingle();
  return !!data;
}

const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 10;

export async function getLockRemainingSeconds(ip: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_login_attempts")
    .select("locked_until")
    .eq("ip", ip)
    .maybeSingle();
  if (!data?.locked_until) return 0;
  const diff = new Date(data.locked_until).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export async function registerFailure(ip: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_login_attempts")
    .select("fail_count")
    .eq("ip", ip)
    .maybeSingle();

  const failCount = (data?.fail_count ?? 0) + 1;
  const lockedUntil =
    failCount >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      : null;

  await supabaseAdmin
    .from("admin_login_attempts")
    .upsert(
      { ip, fail_count: lockedUntil ? 0 : failCount, locked_until: lockedUntil },
      { onConflict: "ip" },
    );

  return lockedUntil ? LOCK_MINUTES * 60 : 0;
}

export async function clearFailures(ip: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_login_attempts").delete().eq("ip", ip);
}

/** Journal d'activité admin (table deny-all, écrite uniquement côté serveur). */
export async function logAdmin(
  action: string,
  fields: { detail?: string; targetEmail?: string; targetId?: string } = {},
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_logs").insert({
      action: action.slice(0, 80),
      detail: fields.detail?.slice(0, 300) ?? null,
      target_email: fields.targetEmail?.slice(0, 255) ?? null,
      target_id: fields.targetId?.slice(0, 100) ?? null,
      ip: getClientIp(),
    });
  } catch {
    // Le journal ne doit jamais casser une action admin.
  }
}
