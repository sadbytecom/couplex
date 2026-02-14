// public/service-worker.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Couplex';
  const options = {
    body: data.body || 'Partner sdílí emoci',
    icon: '/heart-icon.png', // Postav si svoje ikony v public/
    badge: '/badge-icon.png',
    tag: 'couplex-emotion',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      emotionType: data.emotionType
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Klik na notifikaci - otevře aplikaci
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Pokud je aplikace už otevřená, fokusuj ji
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Jinak otevři nové okno
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});