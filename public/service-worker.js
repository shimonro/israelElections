// The previous version of this site registered a caching service worker.
// This replacement unregisters it so returning visitors get the current site.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  await self.registration.unregister()
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((client) => client.navigate(client.url))
})
