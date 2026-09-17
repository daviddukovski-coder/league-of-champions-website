// Service worker for Firebase Cloud Messaging (Web Push).
// Must live at the site root so its push scope covers the whole origin.
// Runs in its own worker context — no access to index.html's CONFIG object,
// so the Firebase config is repeated here (these are public client identifiers,
// not secrets; real access control lives in Firestore security rules).

importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDKJ4a2LPDL6PmKrUFr9B8i_6sdIIDl65M',
  authDomain: 'league-of-champions-website.firebaseapp.com',
  projectId: 'league-of-champions-website',
  appId: '1:924054417519:web:e60309941122709ea09d9a',
  messagingSenderId: '924054417519'
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var data = payload.notification || {};
  self.registration.showNotification(data.title || 'League of Champions', {
    body: data.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // data.url is a bare hash-path (e.g. "inbox/xyz"), matching this SPA's
  // own navigate() helper — build the real hash URL relative to the SW's scope.
  var path = (event.notification.data && event.notification.data.url) || '';
  var url = self.registration.scope + '#/' + path;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) { list[i].navigate(url); return list[i].focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
