import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_series",
  title: "Lister les séries",
  description: "Liste les séries créées par l'utilisateur connecté.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("series")
      .select("id,name,description,created_at")
      .order("created_at", { ascending: false });
    return error ? fail(error.message) : ok(data ?? []);
  },
});
