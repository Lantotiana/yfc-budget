self.importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js')
self.importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCv109BcBb7JPtybDJbaLk9lln8kxdMh44',
  authDomain: 'yfc-budget.firebaseapp.com',
  projectId: 'yfc-budget',
  storageBucket: 'yfc-budget.firebasestorage.app',
  messagingSenderId: '998337155628',
  appId: '1:998337155628:web:19c1a6f7fba9530827f789',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || payload.data?.title || 'YFC'
  const body = payload.notification?.body || payload.data?.body || ''
  const link = payload.fcmOptions?.link || payload.data?.link || '/notifications'

  self.registration.showNotification(title, {
    body,
    icon: '/Yfc_icone.png',
    badge: '/Yfc_icone.png',
    data: { link },
    tag: payload.data?.notificationId || undefined,
    renotify: true,
  })
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const link = event.notification?.data?.link || '/notifications'

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const matchingClient = allClients.find(client => client.url.includes(self.location.origin))

    if (matchingClient) {
      await matchingClient.focus()
      matchingClient.navigate(link)
      return
    }

    await self.clients.openWindow(link)
  })())
})
