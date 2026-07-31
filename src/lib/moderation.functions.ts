import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(150),
  image: z.string().max(8_000_000).optional(),
});

export type ModerationResult = {
  isAdult: boolean;
  title: { ok: boolean; realBook: boolean; reason: string | null };
  cover: { allowed: boolean; reason: string | null } | null;
};

/** Vérifie le titre (ouvrage réel / non offensant) et l'image (NSFW, gore, pertinence). */
export const moderateBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ModerationResult> => {
    const { verifyTitle, verifyImage, isAdultFrom } = await import("@/lib/moderation.server");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("birth_date")
      .eq("id", context.userId)
      .maybeSingle();
    const isAdult = isAdultFrom((profile as { birth_date: string | null } | null)?.birth_date ?? null);

    const title = await verifyTitle(data.title, data.author);

    let cover: ModerationResult["cover"] = null;
    if (data.image) {
      const verdict = await verifyImage(data.image);
      if (verdict) {
        if (!verdict.isBookCover && !verdict.nsfw && !verdict.gore) {
          cover = {
            allowed: false,
            reason: verdict.reason ?? "Cette image ne ressemble pas à une couverture de livre.",
          };
        } else if (verdict.nsfw) {
          cover = { allowed: false, reason: "Image à caractère sexuel : couverture retirée." };
        } else if (verdict.gore) {
          cover = isAdult
            ? { allowed: true, reason: null }
            : {
                allowed: false,
                reason: "Image gore réservée aux membres de 18 ans et plus : couverture retirée.",
              };
        } else {
          cover = { allowed: true, reason: null };
        }
      }
    }

    return { isAdult, title, cover };
  });
