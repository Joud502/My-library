import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const LANGUAGES = {
  fr: "Français",
  en: "English",
  es: "Español",
  it: "Italiano",
  ar: "العربية",
  sv: "Svenska",
  la: "Latina",
} as const;

export type Lang = keyof typeof LANGUAGES;
export type LangSetting = Lang | "system";

const STORAGE_KEY = "app-language";

/** Langue du navigateur / système, repli sur le français. */
export function systemLang(): Lang {
  if (typeof navigator === "undefined") return "fr";
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = (tag ?? "").slice(0, 2).toLowerCase() as Lang;
    if (code in LANGUAGES) return code;
  }
  return "fr";
}

type Dict = Record<string, string>;

const fr: Dict = {
  "settings.title": "Paramètres",
  "settings.subtitle":
    "Votre pseudo, la visibilité de votre album et la messagerie entre membres.",
  "settings.language": "Langue de l'application",
  "settings.languageHint": "« Système » suit la langue de votre navigateur.",
  "settings.system": "Système",
  "settings.save": "Enregistrer",
  "book.read": "Lire",
  "book.download": "Télécharger",
  "book.searching": "Recherche d'une édition gratuite…",
  "book.none": "Aucune lecture gratuite légale disponible pour ce livre.",
  "book.opened": "Ouverture de la lecture en ligne…",
  "book.downloading": "Téléchargement du fichier…",
};

const en: Dict = {
  "settings.title": "Settings",
  "settings.subtitle": "Your username, album visibility and member messaging.",
  "settings.language": "App language",
  "settings.languageHint": "“System” follows your browser language.",
  "settings.system": "System",
  "settings.save": "Save",
  "book.read": "Read",
  "book.download": "Download",
  "book.searching": "Looking for a free edition…",
  "book.none": "No free legal reading available for this book.",
  "book.opened": "Opening the online reader…",
  "book.downloading": "Downloading the file…",
};

const es: Dict = {
  "settings.title": "Ajustes",
  "settings.subtitle": "Tu alias, la visibilidad de tu álbum y la mensajería entre miembros.",
  "settings.language": "Idioma de la aplicación",
  "settings.languageHint": "«Sistema» sigue el idioma del navegador.",
  "settings.system": "Sistema",
  "settings.save": "Guardar",
  "book.read": "Leer",
  "book.download": "Descargar",
  "book.searching": "Buscando una edición gratuita…",
  "book.none": "No hay lectura gratuita legal para este libro.",
  "book.opened": "Abriendo el lector en línea…",
  "book.downloading": "Descargando el archivo…",
};

const it: Dict = {
  "settings.title": "Impostazioni",
  "settings.subtitle": "Il tuo nickname, la visibilità dell'album e i messaggi tra membri.",
  "settings.language": "Lingua dell'applicazione",
  "settings.languageHint": "«Sistema» segue la lingua del browser.",
  "settings.system": "Sistema",
  "settings.save": "Salva",
  "book.read": "Leggi",
  "book.download": "Scarica",
  "book.searching": "Ricerca di un'edizione gratuita…",
  "book.none": "Nessuna lettura gratuita legale per questo libro.",
  "book.opened": "Apertura del lettore online…",
  "book.downloading": "Download del file…",
};

const ar: Dict = {
  "settings.title": "الإعدادات",
  "settings.subtitle": "اسمك المستعار، ظهور ألبومك والمراسلة بين الأعضاء.",
  "settings.language": "لغة التطبيق",
  "settings.languageHint": "«النظام» يتبع لغة المتصفح.",
  "settings.system": "النظام",
  "settings.save": "حفظ",
  "book.read": "قراءة",
  "book.download": "تنزيل",
  "book.searching": "البحث عن نسخة مجانية…",
  "book.none": "لا توجد قراءة مجانية قانونية لهذا الكتاب.",
  "book.opened": "جارٍ فتح القارئ…",
  "book.downloading": "جارٍ تنزيل الملف…",
};

const sv: Dict = {
  "settings.title": "Inställningar",
  "settings.subtitle": "Ditt användarnamn, albumets synlighet och meddelanden mellan medlemmar.",
  "settings.language": "Appspråk",
  "settings.languageHint": "”System” följer webbläsarens språk.",
  "settings.system": "System",
  "settings.save": "Spara",
  "book.read": "Läs",
  "book.download": "Ladda ner",
  "book.searching": "Söker en gratis utgåva…",
  "book.none": "Ingen gratis laglig läsning finns för den här boken.",
  "book.opened": "Öppnar onlineläsaren…",
  "book.downloading": "Laddar ner filen…",
};

const la: Dict = {
  "settings.title": "Optiones",
  "settings.subtitle": "Nomen tuum, albi visibilitas et nuntii inter sodales.",
  "settings.language": "Lingua applicationis",
  "settings.languageHint": "«Systema» linguam navigatri sequitur.",
  "settings.system": "Systema",
  "settings.save": "Servare",
  "book.read": "Legere",
  "book.download": "Deponere",
  "book.searching": "Editio gratuita quaeritur…",
  "book.none": "Nulla lectio gratuita legitima huic libro praesto est.",
  "book.opened": "Lector interretialis aperitur…",
  "book.downloading": "Fasciculus deponitur…",
};

const DICTS: Record<Lang, Dict> = { fr, en, es, it, ar, sv, la };

type Ctx = {
  setting: LangSetting;
  lang: Lang;
  setSetting: (value: LangSetting) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<LangSetting>("system");
  const [sysLang, setSysLang] = useState<Lang>("fr");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LangSetting | null;
    if (stored && (stored === "system" || stored in LANGUAGES)) setSettingState(stored);
    setSysLang(systemLang());
  }, []);

  const lang: Lang = setting === "system" ? sysLang : setting;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      setting,
      lang,
      setSetting: (next) => {
        setSettingState(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
      t: (key) => DICTS[lang][key] ?? fr[key] ?? key,
    }),
    [setting, lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
