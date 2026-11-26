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
  // Anmeldung mit Apple erst anzeigen, wenn die Apple-Services-ID in Firebase eingerichtet ist (docs/WEB_CHECKOUT.md, Schritt 3).
  // Web sign-in uses email links. Enable emailLink only after provider/domain preflight; no SMS UI.
  signIn: Object.freeze({ apple: false, emailLink: true, funnelAfterEmail: true, google: true, offerAfterAnswer: true }),
  // Server-side normal-answer introduction. Enable only after backend/auth readiness checks.
  // GrowthBook is evaluated on the backend, never trusted for browser entitlements.
  translatorGate: Object.freeze({
    enabled: true,
    endpoint: "https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web",
    supporter: Object.freeze({ enabled: false, reviewed: false, kind: "one-time", url: "" })
  }),
  // Answer links: backend creation must be enabled and approved first (docs/WEB_SNAPSHOT_LINKS.md in the app repo).
  snapshotLinks: Object.freeze({ enabled: true, mode: 'auto' }),
  appStoreURL: "https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=web_abo&mt=8"
});

// A/B-Test „Anmeldung“ (Daniel, 20. Nov 2026), 50/50 pro Tab-Sitzung:
//   standard = Anmelde-Layer, danach Weiterleitung in den Web-Funnel; funnel = der Web-Funnel selbst kommt als Layer von unten.
// ?anmeldung=funnel / ?anmeldung=standard legt die Variante fest (Vorschau). Automatisierte Browser bekommen immer „standard“.
// Die Adresse wird später vom Übersetzer bereinigt, deshalb schon hier lesen. Kein Cookie, nur sessionStorage; Messen nur mit Einwilligung.
try {
  const key = "demenzcoach.anmeldungVariante.v1";
  const choice = new URLSearchParams(location.search).get("anmeldung");
  if (choice === "funnel" || choice === "standard") sessionStorage.setItem(key, choice);
  // Daniel, 26. Nov 2026: generell zuerst die kostenlose Anmeldung, dann Fragebogen, dann Paywall. Test beendet: immer „standard“.
  else sessionStorage.setItem(key, "standard");
} catch { /* Ohne Speicher bleibt die normale Anmeldung. */ }

// Läuft der Funnel als Layer (A/B-Test), kommt Stripe mit der Adresse /abo/ zurück in den Rahmen. Dann den ganzen Tab dorthin bringen.
try {
  if (self !== top && location.pathname.startsWith("/abo/") && top.location.origin === location.origin) top.location.replace(location.href);
} catch { /* Fremder Rahmen: nichts tun. */ }
