// Kasse als Fenster auf derselben Seite (Daniel, 9. Nov 2026: wie BetterMe und Yazio, die Zahlung öffnet sich über der
// Angebotsseite). Wird von /start/ geladen (window.DemenzKasse.open). Die Seite /abo/ bleibt als eigener Einstieg.
// Kein eigenes Zahlungsformular (Daniel, 24. Nov 2026: eingebettetes Stripe Elements sieht schlecht aus). Die Ebene zeigt nur
// kurz „Weiter zur sicheren Zahlung“ und leitet im selben Tab auf die gehostete Stripe-Seite, nie in ein neues Fenster.
import { createHostedCheckoutRedirect } from "./checkout-redirect.js";
import { hostWindow, loadStripe, showEmbeddedCheckout } from "./kasse-embedded.js";
// Läuft die Kasse im Layer (Funnel-Rahmen, iframe), muss das ganze Fenster zu Stripe wechseln: Stripes Seite lässt sich nicht
// in einem Rahmen laden und bliebe dort endlos beim Lade-Skeleton (Daniel, 26. Nov 2026).
const redirectHostedCheckout = createHostedCheckoutRedirect((url) => {
  if (window.top !== window) { try { window.top.location.assign(url); return; } catch { /* anderer Ursprung: unten im eigenen Fenster */ } }
  location.assign(url);
});
const config = window.DEMENZ_ABO_CONFIG || {};
const firebaseVersion = "12.16.0";

let firebase = null;
let auth = null;
let publicConfig = null;
let sheet = null;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response;
  try {
    response = await fetch(`${config.endpoint}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } catch (problem) {
    throw Object.assign(new Error("network"), { code: problem?.name === "AbortError" ? "timeout" : "network" });
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

// Kurze Störungen (Netz, Zeitüberschreitung, Serverfehler) versuchen wir selbst noch zweimal, bevor wir den Kunden stören.
const AUTO_RETRIES = 2;
const isTransient = (problem) => problem?.code === "network" || problem?.code === "timeout" || problem?.status >= 500 || problem?.message === "hosted_checkout_unavailable";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tempo (Daniel, 26. Nov 2026): Vorbereitung und Klick laufen oft gleichzeitig. Firebase, Gast-Konto und /config dürfen nur
// einmal starten, sonst entstehen zwei Gast-Konten und zwei Stripe-Sitzungen, und die Kasse wartet auf die zweite.
let authReady = null, anonymousSignIn = null, configLoading = null;
async function initAuth() {
  const [{ initializeApp }, authModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`)
  ]);
  firebase = authModule;
  auth = firebase.getAuth(initializeApp(config.firebase));
  auth.languageCode = "de";
  await new Promise((resolve) => { const stop = firebase.onAuthStateChanged(auth, () => { stop(); resolve(); }); });
}
async function signedInUser() {
  // Immer auf den gespeicherten Nutzer warten (27. Nov 2026): Ein zweiter Aufrufer darf nicht vor onAuthStateChanged
  // weitermachen. Sonst ist currentUser noch leer, und ein angemeldetes Konto bekäme ein neues Gastkonto.
  await (authReady ||= initAuth().catch((problem) => { authReady = null; throw problem; }));
  // Wie Noom und BetterMe: erst bezahlen, Konto danach. Das Gast-Konto trägt den Kauf; eine bestätigte E-Mail wird anschließend mit derselben Nutzerkennung verknüpft.
  if (auth.currentUser) return auth.currentUser;
  return (anonymousSignIn ||= firebase.signInAnonymously(auth).then((credential) => credential.user).finally(() => { anonymousSignIn = null; }));
}
function loadConfig() {
  if (publicConfig) return Promise.resolve(publicConfig);
  return (configLoading ||= api("/config").then((loaded) => { configLoading = null; publicConfig = loaded; return loaded; }, (problem) => { configLoading = null; throw problem; }));
}

// Stripes eingebettete Zahlungsseite im obersten Layer (kasse-embedded.js). Zurück-Taste und close() müssen sie auch schließen.
let embedded = null;

function close() {
  if (embedded) { embedded.close(); return; }
  if (!sheet) return;
  sheet.node.remove();
  document.body.classList.remove("start-noscroll");
  sheet.onClose?.();
  sheet = null;
}

// Pflichtangaben über Stripes Formular (ui_mode "form" kennt keine eigenen Texte): Preis inkl. MwSt., Laufzeit, Kündigung, Probezeit.
const euro = (cents) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
function termsFor(session) {
  const amount = publicConfig?.plans?.[session?.plan]?.amount;
  if (!Number.isFinite(amount)) return "";
  const trial = session.trialDays > 0 ? `${session.trialDays} Tage kostenlos, dann ` : "";
  if (session.plan === "yearly") {
    const first = Number.isFinite(session.firstYear) ? session.firstYear : amount;
    const price = first !== amount ? `${euro(first)} im ersten Jahr, danach ${euro(amount)} pro Jahr` : `${euro(amount)} pro Jahr`;
    return `${trial}${price} inkl. MwSt. 1 Jahr Mindestlaufzeit, danach unbefristet mit 1 Monat Kündigungsfrist.${trial ? " Kündigst du vorher, zahlst du nichts." : ""}`;
  }
  return `${trial}${euro(amount)} pro Monat inkl. MwSt. Verlängert sich monatlich, jederzeit zum Monatsende kündbar.${trial ? " Kündigst du vorher, zahlst du nichts." : ""}`;
}

// Tempo (Daniel, 26. Nov 2026: die Zahlung muss sofort kommen): Konto, Konfiguration und die Stripe-Sitzung werden schon
// vorbereitet, wenn die Angebotsseite erscheint. Der Klick leitet dann ohne Wartezeit weiter. Unbezahlte Sitzungen verfallen nach 24 Stunden.
const PREPARED_MAX_AGE = 15 * 60_000;
const preparedSessions = new Map();
// Handy (unter 900 px): alle Kaufknöpfe führen auf Stripes eigene Seite (Daniel, 26. Nov 2026: „Ja, alle am Handy zu Stripe“,
// vorher nur der Link „Mit Karte oder anderer Zahlart bezahlen“). Am Desktop bleibt es beim Layer mit Stripes Formular.
const toStripePage = () => hostWindow().matchMedia?.("(min-width: 900px)")?.matches === false;
function sessionBody(options) {
  const stripePage = toStripePage(options);
  return { plan: options.plan, termsVersion: publicConfig.textVersions?.terms, source: options.source, campaign: options.campaign,
    ...window.DemenzTeller?.attribution(),
    ...window.DemenzConsent?.metaContext?.(),
    hostedFallback: true,
    // Stripes eingebettete Zahlungsseite im Layer, wenn der Server sie anbietet (Daniel, 26. Nov 2026). Ältere Server ignorieren das Feld und liefern die gehostete Seite.
    ...(publicConfig.embedded === true && !stripePage ? { embedded: true } : {}),
    // Stripes kürzeres Formular (Daniel, 26. Nov 2026: Bezahlknopf direkt sichtbar). ?kasse=seite zeigt zum Vergleich die bisherige Stripe-Seite.
    ...(publicConfig.form === true && !stripePage && !/[?&]kasse=seite\b/u.test(location.search) ? { form: true } : {}),
    ...(publicConfig.walletEmail === true && !options.email ? { emailLater: true } : {}),
    ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}) };
}
function sessionFor(options, user, token) {
  const meta = window.DemenzConsent?.metaContext?.()?.meta?.consent === true;
  const key = JSON.stringify([user.uid, options.plan, options.email || "", options.offer || null, options.source || "", options.campaign || "", meta, toStripePage(options)]);
  const hit = preparedSessions.get(key);
  if (hit && Date.now() - hit.at < PREPARED_MAX_AGE) return hit.promise;
  const promise = api("/session", { method: "POST", token, body: sessionBody(options) });
  preparedSessions.set(key, { at: Date.now(), promise });
  promise.catch(() => { if (preparedSessions.get(key)?.promise === promise) preparedSessions.delete(key); });
  return promise;
}
async function prepareOnce(options) {
  const [loadedConfig, user] = await Promise.all([loadConfig(), signedInUser()]);
  publicConfig = loadedConfig;
  await window.DemenzTeller?.ready;
  if (publicConfig.embedded === true) loadStripe(hostWindow()).catch(() => {});
  const token = await user.getIdToken();
  const session = await sessionFor(options, user, token);
  return session;
}
// prepare({ plan, email, offer, source, campaign }): leise im Hintergrund, Fehler werden ignoriert (der Klick versucht es dann selbst).
export function prepare(options) {
  if (!config.endpoint || !config.firebase?.apiKey) return Promise.resolve(false);
  return prepareOnce(options).then(() => true, () => false);
}

// open({ plan, email, offer, source, campaign, onClose, onOfferExpired, track })
export async function open(options) {
  if (sheet?.pending && sheet.plan === options.plan && sheet.email === options.email && (!sheet.uid || sheet.uid === auth?.currentUser?.uid)) return;
  close();
  const attempt = {};
  const error = el("p", { class: "abo-error", role: "alert", hidden: "" });
  const fail = (message) => { error.textContent = message; error.hidden = false; error.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const loading = el("p", { class: "kasse-loading", role: "status", text: "Die sichere Zahlung wird geöffnet …" });
  let loadingTimer = null;
  const title = el("h2", { id: "kasse-title", tabindex: "-1", text: options.plan === "yearly" ? "Jahresplan starten" : "Monatsplan starten" });
  const card = el("div", { class: "kasse-card" }, [
    el("div", { class: "kasse-head" }, [title, el("button", { type: "button", class: "kasse-close", "aria-label": "Schließen", text: "×", onclick: () => close() })]),
    error,
    loading
  ]);
  // Daniel, 26. Nov 2026: ein Klick neben die Kasse schließt sie nicht mehr (versehentlich weggeklickt). Schließen nur über das ×.
  const node = el("div", { class: "kasse", role: "dialog", "aria-modal": "true", "aria-labelledby": "kasse-title" }, card);
  const onKey = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  sheet = { node, plan: options.plan, email: options.email, pending: true,
    detach: () => { clearTimeout(loadingTimer); document.removeEventListener("keydown", onKey); },
    onClose: () => { clearTimeout(loadingTimer); document.removeEventListener("keydown", onKey); options.onClose?.(); } };
  document.body.append(node);
  document.body.classList.add("start-noscroll");
  title.focus();
  loadingTimer = setTimeout(() => {
    if (sheet?.node === node && !loading.hidden) loading.textContent = "Das Laden dauert länger. Du kannst die Kasse schließen und erneut öffnen.";
  }, 15_000);

  let checkoutUID = null;
  const currentAttempt = () => sheet?.node === node && checkoutUID && auth?.currentUser?.uid === checkoutUID;
  const requireCurrentAccount = () => {
    if (!sheet || sheet.node !== node) return false;
    if (!currentAttempt()) throw Object.assign(new Error("checkout_account_changed"), { code: "checkout_account_changed" });
    return true;
  };

  try {
    const begin = async () => {
      const [loadedConfig, user] = await Promise.all([loadConfig(), signedInUser()]);
      checkoutUID = user.uid;
      if (sheet?.node === node) sheet.uid = checkoutUID;
      if (!requireCurrentAccount()) return;
      publicConfig = loadedConfig;
      await window.DemenzTeller?.ready;
      const token = await user.getIdToken();
      if (!requireCurrentAccount()) return;
      // Daniel, 24. Nov 2026: kein eigenes eingebettetes Stripe-Formular. Apple Pay und Google Pay stehen auf der gehosteten
      // Stripe-Seite oben, die E-Mail kommt von Stripe, wenn sie hier noch nicht bekannt ist.
      loading.textContent = "Weiter zur sicheren Zahlung bei Stripe …";
      const session = await sessionFor(options, user, token);
      if (!requireCurrentAccount()) return;
      if (session?.checkoutMode === "embedded" || session?.checkoutMode === "form") {
        // Stripes eigene Zahlungsseite im obersten Layer. Dieses Fenster (Ladehinweis) verschwindet leise, ohne onClose.
        sheet.detach();
        sheet.node.remove();
        sheet = null;
        document.body.classList.remove("start-noscroll"); // das Layer sperrt das Scrollen selbst und gibt es beim Schließen wieder frei
        await showEmbeddedCheckout({ session, publishableKey: publicConfig.publishableKey, title: title.textContent, terms: termsFor(session),
          onClose: () => options.onClose?.(), onRetry: () => { preparedSessions.clear(); open({ ...options }); },
          onOpen: (handle) => { embedded = handle; }, onDispose: () => { embedded = null; }, track: options.track });
        options.track?.("checkout_sheet_ready");
        return;
      }
      if (!redirectHostedCheckout(session, { attempt, isCurrent: currentAttempt })) throw new Error("hosted_checkout_unavailable");
      if (sheet?.node === node) sheet.redirected = true;
      options.track?.("checkout_sheet_ready");
    };
    for (let tries = 0; ; tries++) {
      try { await begin(); break; } catch (problem) {
        if (!isTransient(problem) || tries >= AUTO_RETRIES || sheet?.node !== node) throw problem;
        options.track?.("checkout_auto_retry");
        loading.textContent = "Die Verbindung ist langsam. Ich versuche es noch einmal …";
        await wait(1500 * (tries + 1));
        if (sheet?.node !== node) return;
      }
    }
  } catch (problem) {
    clearTimeout(loadingTimer);
    loading.hidden = true;
    if (!sheet || sheet.node !== node) return;
    if (problem.code === "checkout_account_changed") {
      fail("Dein Konto hat sich geändert. Öffne die Zahlung für dein aktuelles Konto erneut.");
      card.append(el("button", { type: "button", class: "abo-button", text: "Erneut versuchen",
        onclick: () => { if (sheet?.node === node) open({ ...options, email: auth?.currentUser?.email || undefined }); } }));
      return;
    }
    if (problem.code === "already_subscribed") {
      card.append(el("p", { text: "Du hast schon ein Abo. Dein Plan ist freigeschaltet." }), el("a", { class: "abo-button", href: "/abo/mein-plan.html", text: "Zu deinem Plan" }));
      return;
    }
    if (problem.code === "offer_expired" || problem.code === "invalid_offer") {
      close();
      return options.onOfferExpired?.();
    }
    if (problem.code === "email_required") return fail("Bitte gib deine E-Mail-Adresse ein. Geh dafür einen Schritt zurück.");
    if (problem.code === "terms_outdated") return fail("Die Seite ist nicht mehr aktuell. Bitte lade sie neu.");
    options.track?.("checkout_load_failed");
    fail(isTransient(problem)
      ? "Die Zahlung konnte nicht geladen werden. Das liegt meist an der Internetverbindung. Du hast nichts bezahlt."
      : "Die Zahlung kann gerade nicht starten. Du hast nichts bezahlt. Bitte versuch es noch einmal.");
    card.append(
      el("button", { type: "button", class: "abo-button", text: "Erneut versuchen", onclick: () => { if (sheet?.node === node) open(options); } }),
      el("a", { class: "kasse-help", href: "/kontakt.html", text: "Klappt es nicht? Schreib uns, wir helfen sofort." })
    );
  } finally {
    if (sheet?.node === node) sheet.pending = false;
  }
}

// --- Apple Pay direkt auf der Angebotsseite (Test mit ?ap=1, Daniel 24. Nov 2026: wie Tolan, ein Tipp) -------------------
// Nur der Express-Knopf von Stripe, kein Kartenformular. Geräte ohne Apple Pay sehen nichts und lösen weder Stripe.js noch eine Sitzung aus.
const quickSessions = new Map();
const quickSupported = () => { try { return window.ApplePaySession?.canMakePayments?.() === true; } catch { return false; } };
function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/dahlia/stripe.js"; // gleiche Version wie die Checkout-Session (ui_mode elements)
    script.onload = resolve;
    script.onerror = () => reject(new Error("stripe.js failed"));
    document.head.append(script);
  });
}
// mountApplePay(slot, { plan, email, offer, source, campaign, track, onUnavailable }) -> Promise<boolean> (true = Knopf sichtbar)
export async function mountApplePay(slot, options) {
  if (!quickSupported()) return false;
  let key = "";
  try {
    const [loadedConfig, user] = await Promise.all([loadConfig(), signedInUser()]);
    // Die Apple-Pay-Sitzung gehört genau zu diesem Konto. Wechselt das Konto, entsteht eine neue Sitzung.
    key = `${user.uid}|${options.plan}|${options.offer?.kind ?? ""}|${options.email ?? ""}`;
    publicConfig = loadedConfig;
    await window.DemenzTeller?.ready;
    if (!quickSessions.has(key)) {
      quickSessions.set(key, (async () => {
        const token = await user.getIdToken();
        const session = await api("/session", {
          method: "POST",
          token,
          body: { plan: options.plan, termsVersion: publicConfig.textVersions?.terms, source: options.source, campaign: options.campaign,
            ...window.DemenzTeller?.attribution(),
            ...(publicConfig.walletEmail === true && !options.email ? { emailLater: true } : {}),
            ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}) }
        });
        if (!session.clientSecret) throw new Error("no_client_secret");
        return session.clientSecret;
      })());
      quickSessions.get(key).catch(() => quickSessions.delete(key));
    }
    const clientSecret = await quickSessions.get(key);
    await loadStripeScript();
    const stripe = window.Stripe(publicConfig.publishableKey, { locale: "de" });
    const init = stripe.initCheckoutElementsSdk ?? stripe.initCheckout;
    const checkout = await init.call(stripe, { clientSecret, elementsOptions: { appearance: { theme: "stripe", variables: { colorPrimary: "#47408c", borderRadius: "999px" } } } });
    const express = checkout.createExpressCheckoutElement({
      buttonType: { applePay: "subscribe" }, buttonHeight: 55, layout: { maxColumns: 1, maxRows: 1, overflow: "auto" },
      paymentMethods: { applePay: "always", googlePay: "never", link: "never", paypal: "never", amazonPay: "never", klarna: "never" }
    });
    const visible = new Promise((resolve) => {
      express.on("availablepaymentmethodschange", ({ paymentMethods }) => {
        if (paymentMethods?.applePay) { options.track?.("apple_pay_quick_shown"); resolve(true); } else resolve(false);
      });
    });
    express.on("confirm", async (event) => {
      options.track?.("apple_pay_quick_confirm");
      try {
        const loaded = await checkout.loadActions?.();
        const result = await (loaded?.actions ?? checkout).confirm({ expressCheckoutConfirmEvent: event });
        if (result?.type === "error" || result?.error) options.onError?.(result.error?.message || "Die Zahlung hat nicht geklappt.");
      } catch {
        options.onError?.("Die Zahlung hat nicht geklappt. Bitte versuch es noch einmal.");
      }
    });
    express.mount(slot);
    return await visible;
  } catch (problem) {
    quickSessions.delete(key);
    options.onUnavailable?.(problem);
    return false;
  }
}

// Zurück von Stripes Seite: Der Browser zeigt die alte Seite samt Ladefenster wieder an, darum schließen wir es.
window.addEventListener("pageshow", (event) => { if (event.persisted && sheet?.redirected) close(); });

export const isOpen = () => Boolean(sheet || embedded);
window.DemenzKasse = Object.freeze({ open, close, isOpen, mountApplePay, prepare });
