import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "update_book",
  title: "Mettre à jour un livre",
  description: "Met à jour les informations d'un livre (statut, note, genre, notes...).",
  inputSchema: {
    id: z.string().uuid().describe("Identifiant du livre à modifier."),
    title: z.string().optional(),
    author: z.string().optional(),
    genre: z.string().optional(),
    published_year: z.number().int().optional(),
    pages: z.number().int().optional(),
    rating: z.number().int().optional().describe("Note de 1 à 5."),
    status: z.enum(["a_lire", "en_cours", "lu"]).optional(),
    notes: z.string().optional(),
    series_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length === 0) return fail("Aucun champ à mettre à jour.");
    const { data, error } = await supabaseForUser(ctx)
      .from("books")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    return error ? fail(error.message) : ok(data);
  },
});
