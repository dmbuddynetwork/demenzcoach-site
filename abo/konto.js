// Gemeinsame Abo-Prüfung für die Seiten nur für Abonnenten („Mein Plan“, „Über Mama“-Blatt):
// Firebase-Konto (dasselbe wie die App) und GET /entitlement der Web-Kasse.
const firebaseVersion = "12.16.0";

// "active" | "signed-out" | "no-subscription" | "error"; mit onEntitlement bekommt die Seite die Abo-Daten (z. B. startedAt).
export async function subscriberState(config, onEntitlement = () => {}) {
  try {
    if (!config.firebase.apiKey) throw new Error("firebase not configured");
    const [{ initializeApp, getApps }, auth] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`)
    ]);
    const firebaseAuth = auth.getAuth(getApps()[0] || initializeApp(config.firebase));
    const user = await new Promise((resolve) => {
      const stop = auth.onAuthStateChanged(firebaseAuth, (current) => { stop(); resolve(current); });
    });
    if (!user) return "signed-out";
    const response = await fetch(`${config.endpoint}/entitlement`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const entitlement = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(response.status));
    if (entitlement.active) onEntitlement(entitlement);
    return entitlement.active ? "active" : "no-subscription";
  } catch {
    return "error";
  }
}
