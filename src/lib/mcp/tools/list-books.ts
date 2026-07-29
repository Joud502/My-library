import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_books",
  title: "Lister les livres",
  description: "Liste les livres de la bibliothèque de l'utilisateur connecté, avec filtres optionnels.",
  inputSchema: {
    status: z
      .enum(["a_lire", "en_cours", "lu"])
      .optional()
      .describe("Filtrer par statut de lecture."),
    search: z.string().optional().describe("Recherche sur le titre ou l'auteur."),
    limit: z.number().int().optional().describe("Nombre maximum de livres retournés (défaut 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("books")
      .select("id,title,author,genre,published_year,pages,rating,status,notes,series_id,created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    const { data, error } = await query;
    return error ? fail(error.message) : ok(data ?? []);
  },
});
