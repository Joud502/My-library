import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "add_series",
  title: "Ajouter une série",
  description: "Crée une nouvelle série pour regrouper des livres.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Nom de la série."),
    description: z.string().optional().describe("Description de la série."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, description }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("series")
      .insert({ name, description, user_id: ctx.getUserId() })
      .select()
      .single();
    return error ? fail(error.message) : ok(data);
  },
});
