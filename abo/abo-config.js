// Öffentliche Einstellungen der Web-Kasse. Hier stehen nur Werte, die ohnehin im Browser sichtbar sind
// (Stripe-Publishable-Key kommt vom Server, Firebase-Web-Konfiguration ist öffentlich).
// Einrichtung: docs/WEB_CHECKOUT.md, Schritt "Firebase-Web-App".
window.DEMENZ_ABO_CONFIG = Object.freeze({
  endpoint: "https://europe-west1-dementica-df17b.cloudfunctions.net/webCheckout/v1/web-checkout",
  firebase: Object.freeze({
    apiKey: "AIzaSyCluQdOJVa-tMvWnHj6AAajwD0x-FVJFKk",
    authDomain: "dementica-df17b.firebaseapp.com",
    projectId: "dementica-df17b",
    appId: "1:394782501413:web:74292ff25798f54db02dcc"
  }),
  // KI-Antworten im Web-Übersetzer: 1 gratis, dann Probezeit (ki-freigabe.js). Erst mit dem Go-live einschalten.
  translatorGate: Object.freeze({ enabled: false, freeAnswers: 1 }),
  appStoreURL: "https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=web_abo&mt=8"
});
