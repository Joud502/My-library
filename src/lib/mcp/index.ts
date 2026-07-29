import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBooks from "./tools/list-books";
import addBook from "./tools/add-book";
import updateBook from "./tools/update-book";
import deleteBook from "./tools/delete-book";
import listSeries from "./tools/list-series";
import addSeries from "./tools/add-series";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mon-album-mcp",
  title: "Mon Album",
  version: "0.1.0",
  instructions:
    "Outils pour gérer la bibliothèque personnelle « Mon Album » : lister, ajouter, modifier et supprimer des livres, et gérer les séries. Toutes les opérations portent sur la bibliothèque de l'utilisateur connecté.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listBooks, addBook, updateBook, deleteBook, listSeries, addSeries],
});
