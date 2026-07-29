import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "delete_book",
  title: "Supprimer un livre",
  description: "Supprime définitivement un livre de la bibliothèque de l'utilisateur connecté.",
  inputSchema: { id: z.string().uuid().describe("Identifiant du livre à supprimer.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { error } = await supabaseForUser(ctx).from("books").delete().eq("id", id);
    return error ? fail(error.message) : ok({ deleted: id });
  },
});
