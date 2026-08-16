/* Service worker : notifications système type Discord (avec boutons d'action). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const payload = event.data;
  if (!payload || payload.type !== "show-notification") return;
  const { title, options } = payload;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action || "open";
  notification.close();

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const message = { type: "notification-action", action, data };

      for (const client of clients) {
        client.postMessage(message);
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }

      // Aucun onglet ouvert : on ouvre le site directement à la bonne place.
      const url = data.url || "/messages";
      const separator = url.includes("?") ? "&" : "?";
      await self.clients.openWindow(`${url}${separator}na=${encodeURIComponent(action)}`);
    })(),
  );
});
