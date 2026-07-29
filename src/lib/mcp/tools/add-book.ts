import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "add_book",
  title: "Ajouter un livre",
  description: "Ajoute un livre à la bibliothèque de l'utilisateur connecté.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Titre du livre."),
    author: z.string().trim().min(1).describe("Auteur du livre."),
    genre: z.string().optional().describe("Genre littéraire."),
    published_year: z.number().int().optional().describe("Année de publication."),
    pages: z.number().int().optional().describe("Nombre de pages."),
    rating: z.number().int().optional().describe("Note de 1 à 5."),
    status: z
      .enum(["a_lire", "en_cours", "lu"])
      .optional()
      .describe("Statut de lecture (défaut : a_lire)."),
    notes: z.string().optional().describe("Notes personnelles."),
    series_id: z.string().uuid().optional().describe("Identifiant d'une série existante."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("books")
      .insert({ ...input, status: input.status ?? "a_lire", user_id: ctx.getUserId() })
      .select()
      .single();
    return error ? fail(error.message) : ok(data);
  },
});
