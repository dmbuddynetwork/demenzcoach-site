// Kasse als Fenster auf derselben Seite (Daniel, 9. Nov 2026: wie BetterMe und Yazio, die Zahlung öffnet sich über der
// Angebotsseite). Wird von /start/ geladen (window.DemenzKasse.open). Die Seite /abo/ bleibt als eigener Einstieg.
// Kein eigenes Zahlungsformular (Daniel, 24. Nov 2026: eingebettetes Stripe Elements sieht schlecht aus). Die Ebene zeigt nur
// kurz „Weiter zur sicheren Zahlung“ und leitet im selben Tab auf die gehostete Stripe-Seite, nie in ein neues Fenster.
import { createHostedCheckoutRedirect } from "./checkout-redirect.js";
const redirectHostedCheckout = createHostedCheckoutRedirect((url) => location.assign(url));
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
  const response = await fetch(`${config.endpoint}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`);
    error.code = data.code;
    throw error;
  }
  return data;
}

async function signedInUser() {
  if (!auth) {
    const [{ initializeApp }, authModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`)
    ]);
    firebase = authModule;
    auth = firebase.getAuth(initializeApp(config.firebase));
    auth.languageCode = "de";
    await new Promise((resolve) => { const stop = firebase.onAuthStateChanged(auth, () => { stop(); resolve(); }); });
  }
  // Wie Noom und BetterMe: erst bezahlen, Konto danach. Das Gast-Konto trägt den Kauf; eine bestätigte E-Mail wird anschließend mit derselben Nutzerkennung verknüpft.
  return auth.currentUser ?? (await firebase.signInAnonymously(auth)).user;
}

function close() {
  if (!sheet) return;
  sheet.node.remove();
  document.body.classList.remove("start-noscroll");
  sheet.onClose?.();
  sheet = null;
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
  const node = el("div", { class: "kasse", role: "dialog", "aria-modal": "true", "aria-labelledby": "kasse-title",
    onclick: (event) => { if (event.target === node) close(); } }, card);
  const onKey = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  sheet = { node, plan: options.plan, email: options.email, pending: true, onClose: () => { clearTimeout(loadingTimer); document.removeEventListener("keydown", onKey); options.onClose?.(); } };
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
    const [loadedConfig, user] = await Promise.all([publicConfig ? Promise.resolve(publicConfig) : api("/config"), signedInUser()]);
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
    const session = await api("/session", {
      method: "POST",
      token,
      body: { plan: options.plan, termsVersion: publicConfig.textVersions?.terms, source: options.source, campaign: options.campaign,
        ...window.DemenzTeller?.attribution(),
        ...window.DemenzConsent?.metaContext?.(),
        hostedFallback: true,
        ...(publicConfig.walletEmail === true && !options.email ? { emailLater: true } : {}),
        ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}) }
    });
    if (!requireCurrentAccount()) return;
    if (!redirectHostedCheckout(session, { attempt, isCurrent: currentAttempt })) throw new Error("hosted_checkout_unavailable");
    options.track?.("checkout_sheet_ready");
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
    fail("Die Zahlung kann gerade nicht starten. Bitte versuch es gleich noch einmal.");
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
  const key = `${options.plan}|${options.offer?.kind ?? ""}|${options.email ?? ""}`;
  try {
    const [loadedConfig, user] = await Promise.all([publicConfig ? Promise.resolve(publicConfig) : api("/config"), signedInUser()]);
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
      buttonType: { applePay: "subscribe" }, buttonHeight: 55, layout: { maxColumns: 1, maxRows: 1, overflow: "never" },
      paymentMethods: { applePay: "always", googlePay: "never", link: "never", paypal: "never", amazonPay: "never", klarna: "never" }
    });
    const visible = new Promise((resolve) => {
      express.on("availablepaymentmethodschange", ({ paymentMethods }) => {
        if (paymentMethods?.applePay) { options.track?.("apple_pay_quick_shown"); resolve(true); } else resolve(false);
      });
    });
    express.on("confirm", async () => {
      options.track?.("apple_pay_quick_confirm");
      try {
        const loaded = await checkout.loadActions?.();
        const result = await (loaded?.actions ?? checkout).confirm();
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

export const isOpen = () => Boolean(sheet);
window.DemenzKasse = Object.freeze({ open, close, isOpen, mountApplePay });
