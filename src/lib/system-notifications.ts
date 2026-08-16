/** Notifications système (API Web Notifications + service worker) pour appels et messages. */

const ASKED_KEY = "mon-album-notif-asked";
const SW_URL = "/notif-sw.js";

let registration: ServiceWorkerRegistration | null = null;

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/** Enregistre le service worker qui affiche les notifications avec boutons. */
export async function ensureNotificationWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    registration = null;
    return null;
  }
}

/** Demande la permission (une seule fois par appareil tant qu'elle n'est pas accordée). */
export async function requestNotificationPermission(
  force = false,
): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") {
    if (Notification.permission === "granted") void ensureNotificationWorker();
    return Notification.permission;
  }
  if (!force && localStorage.getItem(ASKED_KEY) === "1") return "default";
  localStorage.setItem(ASKED_KEY, "1");
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") void ensureNotificationWorker();
    return permission;
  } catch {
    return Notification.permission;
  }
}

export function hasAskedNotificationPermission() {
  return typeof window !== "undefined" && localStorage.getItem(ASKED_KEY) === "1";
}

export type NotificationAction = { action: string; title: string };

export type NotificationData = {
  /** Type d'événement : "call" | "message" | "friend". */
  kind: string;
  /** Identifiant du membre concerné. */
  peerId?: string;
  /** Identifiant de la demande d'ami. */
  requestId?: string;
  /** Page à ouvrir si aucun onglet n'est actif. */
  url?: string;
};

type SystemNotifyOptions = {
  body?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
  data?: NotificationData;
  /** Utilisé uniquement en repli quand le service worker est indisponible. */
  onClick?: () => void;
};

/** Affiche une notification système (avec boutons quand le navigateur le permet). */
export function systemNotify(title: string, options: SystemNotifyOptions = {}) {
  if (!notificationsSupported() || Notification.permission !== "granted") return null;

  const payload = {
    body: options.body,
    tag: options.tag,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    requireInteraction: options.requireInteraction,
    silent: options.silent,
    actions: options.actions ?? [],
    data: options.data ?? { kind: "generic" },
  };

  // Chemin privilégié : le service worker gère les boutons d'action.
  void (async () => {
    const reg = await ensureNotificationWorker();
    if (!reg) return;
    try {
      await reg.showNotification(title, payload);
    } catch {
      /* ignoré : repli ci-dessous */
    }
  })();

  if (registration) return null;

  try {
    const notif = new Notification(title, {
      body: options.body,
      tag: options.tag,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      requireInteraction: options.requireInteraction,
      silent: options.silent,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
      options.onClick?.();
    };
    return notif;
  } catch {
    return null;
  }
}

/** Ferme les notifications système portant ce tag. */
export async function closeSystemNotifications(tag: string) {
  const reg = registration ?? (await ensureNotificationWorker());
  if (!reg) return;
  const list = await reg.getNotifications({ tag });
  for (const n of list) n.close();
}

type ActionHandler = (action: string, data: NotificationData) => void;

/** Écoute les clics sur les boutons des notifications système. */
export function onNotificationAction(handler: ActionHandler) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const listener = (event: MessageEvent) => {
    const payload = event.data as
      | { type?: string; action?: string; data?: NotificationData }
      | undefined;
    if (!payload || payload.type !== "notification-action") return;
    handler(payload.action ?? "open", payload.data ?? { kind: "generic" });
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}
