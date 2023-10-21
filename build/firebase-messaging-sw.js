// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing the generated config
const firebaseConfig = {
    apiKey: "AIzaSyAjqJrNf8OsEU4JEYsNb6VRAYg5UjwAQyk",
    authDomain: "miscsituet.firebaseapp.com",
    projectId: "miscsituet",
    storageBucket: "miscsituet.appspot.com",
    messagingSenderId: "369130724243",
    appId: "1:369130724243:web:c2f3273ef386b987a86666",
    measurementId: "G-2FLDML5D5K"
};

firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

// messaging.onBackgroundMessage(function (payload) {
//     console.log('Received background message ', payload);

//     const notificationTitle = payload.notification.title;
//     const notificationOptions = {
//         body: payload.notification.body,
//     };

//     self.registration.showNotification(notificationTitle, notificationOptions);
// });