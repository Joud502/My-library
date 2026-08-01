import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "mon-album-remember-device";
const TAB_KEY = "mon-album-session-active";

export function isRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

/** Appelé après une connexion réussie. */
export function setRememberDevice(remember: boolean) {
  try {
    if (remember) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Sans « se souvenir de cet appareil », la session est fermée dès que le
 * navigateur a été quitté (le marqueur de session de l'onglet disparaît).
 */
export async function enforceSessionPolicy() {
  try {
    if (isRemembered()) return;
    if (sessionStorage.getItem(TAB_KEY) === "1") return;
    sessionStorage.setItem(TAB_KEY, "1");
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}
