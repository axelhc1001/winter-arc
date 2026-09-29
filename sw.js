// Service worker: solo para instalar como app y recibir recordatorios.
// No guarda nada en caché, así siempre se ve la versión más nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '❄️ Winter Arc', {
    body: d.body || 'Llena tu día',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-72.png',
    tag: 'recordatorio',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) return w.focus();
    return self.clients.openWindow(e.notification.data.url);
  }));
});
