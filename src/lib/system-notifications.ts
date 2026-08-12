/** Notifications système (API Web Notifications) pour appels et messages. */

const ASKED_KEY = "mon-album-notif-asked";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/** Demande la permission (une seule fois par appareil tant qu'elle n'est pas accordée). */
export async function requestNotificationPermission(force = false): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  if (!force && localStorage.getItem(ASKED_KEY) === "1") return "default";
  localStorage.setItem(ASKED_KEY, "1");
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function hasAskedNotificationPermission() {
  return typeof window !== "undefined" && localStorage.getItem(ASKED_KEY) === "1";
}

type SystemNotifyOptions = {
  body?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  onClick?: () => void;
};

/** Affiche une notification système si la permission est accordée. */
export function systemNotify(title: string, options: SystemNotifyOptions = {}) {
  if (!notificationsSupported() || Notification.permission !== "granted") return null;
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
