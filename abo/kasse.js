// Kasse als Fenster auf derselben Seite (Daniel, 9. Nov 2026: wie BetterMe und Yazio, die Zahlung öffnet sich über der
// Angebotsseite). Wird von /start/ geladen (window.DemenzKasse.open). Die Seite /abo/ bleibt als eigener Einstieg.
// Neue Sitzungen wechseln zum Stripe Hosted Checkout. Bereits geladene ältere
// Kassen und die gestufte Veröffentlichung behalten den Elements-Fallback.
import { createHostedCheckoutRedirect, reserveCheckoutWindow } from "./checkout-redirect.js";
const redirectHostedCheckout = createHostedCheckoutRedirect((url, attempt) => {
  if (attempt?.paymentWindow) attempt.paymentWindow.navigate(url);
  else location.assign(url);
});
// § 312j Abs. 2 BGB: Preis, Laufzeit und Kündigung stehen vor allen Zahlungsknöpfen und direkt über dem Bestellknopf,
// der Bestellknopf heißt „Zahlungspflichtig abonnieren“. Texte gleich wie renderSummary in abo.js.
const config = window.DEMENZ_ABO_CONFIG || {};
const firebaseVersion = "12.16.0";
const euro = (cents, currency = "eur") => new Intl.NumberFormat("de-DE", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const dateText = (date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

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

function loadStripe() {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/dahlia/stripe.js"; // gleiche Version wie die Checkout-Session (ui_mode elements), v3 kennt initCheckout nicht
    script.onload = resolve;
    script.onerror = () => reject(new Error("stripe.js failed"));
    document.head.append(script);
  });
}

export function summaryText(plan, price, trialDays, firstYear = null) {
  const period = plan === "yearly" ? "Jahr" : "Monat";
  const recurring = `${euro(price.amount, price.currency)}/${period}`;
  const deal = Number.isInteger(firstYear) ? euro(firstYear, price.currency) : null;
  if (trialDays > 0) {
    const start = new Date(Date.now() + trialDays * 86_400_000);
    return deal
      ? `Heute 0,00 €. Ab ${dateText(start)}: ${deal} im 1. Jahr, danach ${recurring}. Inkl. MwSt.`
      : `Heute 0,00 €. Ab ${dateText(start)}: ${recurring}. Inkl. MwSt.`;
  }
  return deal
    ? `Heute ${deal} im 1. Jahr, danach ${recurring}. Inkl. MwSt.`
    : `Heute ${euro(price.amount, price.currency)} für 1 ${period}, danach ${recurring}. Inkl. MwSt.`;
}
export const termsText = (plan) => (plan === "yearly"
  ? "1 Jahr Mindestlaufzeit; danach unbefristet, mit 1 Monat Kündigungsfrist."
  : "Verlängert sich monatlich; jederzeit zum Monatsende kündbar.");

function close() {
  if (!sheet) return;
  sheet.node.remove();
  document.body.classList.remove("start-noscroll");
  sheet.onClose?.();
  sheet = null;
}

// open({ plan, email, offer, source, campaign, onClose, onOfferExpired, track })
export async function open(options) {
  if (sheet?.pending && sheet.plan === options.plan && sheet.email === options.email && (!sheet.uid || sheet.uid === auth?.currentUser?.uid)) { sheet.paymentWindow?.focus(); return; }
  if (sheet?.handedOff && sheet.plan === options.plan && sheet.email === options.email && sheet.uid === auth?.currentUser?.uid) { sheet.paymentWindow?.focus(); return; }
  close();
  const paymentWindow = reserveCheckoutWindow(window);
  const attempt = { paymentWindow };
  const error = el("p", { class: "abo-error", role: "alert", hidden: "" });
  const fail = (message) => { error.textContent = message; error.hidden = false; error.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const loading = el("p", { class: "kasse-loading", role: "status", text: "Die sichere Zahlung wird geöffnet …" });
  const summary = el("p");
  const terms = el("p");
  const trialNote = el("p", { hidden: "" });
  let loadingTimer = null;
  const short = el("p", { class: "kasse-short", hidden: "" });
  const divider = el("p", { class: "abo-divider", text: "oder", hidden: "" });
  const express = el("div", { id: "kasse-express" });
  const payment = el("div", { id: "kasse-payment" });
  const payButton = el("button", { type: "button", class: "abo-button", disabled: "", hidden: "", text: "Zahlungspflichtig abonnieren" });
  const emailLine = el("p", { class: "abo-checkout-email", text: options.email ? `Bestätigung und Zugang an ${options.email}` : "" });
  const title = el("h2", { id: "kasse-title", tabindex: "-1", text: options.plan === "yearly" ? "Jahresplan starten" : "Monatsplan starten" });
  const card = el("div", { class: "kasse-card" }, [
    el("div", { class: "kasse-head" }, [title, el("button", { type: "button", class: "kasse-close", "aria-label": "Schließen", text: "×", onclick: () => close() })]),
    error,
    loading, payment,
    el("div", { class: "abo-summary", role: "group", "aria-label": "Preis und Laufzeit", hidden: "" }, [summary, terms]),
    express, divider, short, payButton, emailLine,
    el("div", { class: "abo-checkout-details" }, [trialNote, el("p", {}, ["Online kündbar, ohne Anmeldung (", el("a", { href: "/abo/kuendigen.html", text: "Verträge hier kündigen" }), "). 30 Tage ",
        el("a", { href: "/abo/garantie.html", target: "_blank", text: "Geld-zurück-Garantie" }), ". Es gelten die ",
        el("a", { href: "/nutzungsbedingungen.html", target: "_blank", text: "Nutzungsbedingungen" }), ". ",
        el("a", { href: "/abo/widerruf.html", target: "_blank", text: "Widerrufsbelehrung" }), ". ",
        el("a", { href: "/datenschutz.html", target: "_blank", text: "Datenschutz" }), "."])])
  ]);
  const node = el("div", { class: "kasse", role: "dialog", "aria-modal": "true", "aria-labelledby": "kasse-title",
    onclick: (event) => { if (event.target === node) close(); } }, card);
  const onKey = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  sheet = { node, plan: options.plan, email: options.email, pending: true, paymentWindow, onClose: () => { paymentWindow?.discard(); clearTimeout(loadingTimer); document.removeEventListener("keydown", onKey); options.onClose?.(); } };
  document.body.append(node);
  document.body.classList.add("start-noscroll");
  title.focus();
  loadingTimer = setTimeout(() => {
    if (sheet?.node === node && !loading.hidden) loading.textContent = "Das Laden dauert länger. Du kannst die Kasse schließen und erneut öffnen.";
  }, 15_000);

  let checkout = null;
  let checkoutUID = null;
  const currentAttempt = () => sheet?.node === node && checkoutUID && auth?.currentUser?.uid === checkoutUID;
  const requireCurrentAccount = () => {
    if (!sheet || sheet.node !== node) return false;
    if (!currentAttempt()) throw Object.assign(new Error("checkout_account_changed"), { code: "checkout_account_changed" });
    return true;
  };
  const confirm = async () => {
    payButton.disabled = true;
    error.hidden = true;
    try {
      if (!requireCurrentAccount()) return;
      const loaded = await checkout.loadActions?.();
      if (!requireCurrentAccount()) return;
      const result = await (loaded?.actions ?? checkout).confirm();
      if (result?.type === "error" || result?.error) {
        fail(result.error?.message || "Die Zahlung hat nicht geklappt.");
        payButton.disabled = false;
      }
    } catch {
      fail("Die Zahlung hat nicht geklappt. Bitte versuch es noch einmal.");
      payButton.disabled = false;
    }
  };
  payButton.addEventListener("click", confirm);

  try {
    const [loadedConfig, user] = await Promise.all([publicConfig ? Promise.resolve(publicConfig) : api("/config"), signedInUser()]);
    checkoutUID = user.uid;
    if (sheet?.node === node) sheet.uid = checkoutUID;
    if (!requireCurrentAccount()) return;
    publicConfig = loadedConfig;
    await window.DemenzTeller?.ready;
    const token = await user.getIdToken();
    if (!requireCurrentAccount()) return;
    const session = await api("/session", {
      method: "POST",
      token,
      body: { plan: options.plan, checkoutMode: "hosted", termsVersion: publicConfig.textVersions?.terms, source: options.source, campaign: options.campaign,
        ...window.DemenzTeller?.attribution(),
        ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}) }
    });
    if (!requireCurrentAccount()) return;
    if (redirectHostedCheckout(session, { attempt, isCurrent: currentAttempt })) {
      if (paymentWindow) {
        sheet.handedOff = true;
        clearTimeout(loadingTimer);
        loading.textContent = "Die sichere Zahlung ist in einem neuen Fenster geöffnet.";
        const focus = el("button", { type: "button", class: "abo-button", text: "Zahlungsfenster anzeigen", onclick: () => {
          if (sheet?.node !== node) return;
          if (!currentAttempt()) return fail("Dein Konto hat sich geändert. Öffne die Zahlung für dein aktuelles Konto erneut.");
          if (paymentWindow.focus()) return;
          fail("Das Zahlungsfenster lässt sich hier nicht erneut anzeigen. Du kannst dieselbe Zahlung in diesem Tab öffnen oder den Abo-Status prüfen.");
          focus.textContent = "Zahlung in diesem Tab öffnen";
          focus.onclick = () => { if (currentAttempt()) location.assign(session.url); else fail("Dein Konto hat sich geändert. Öffne die Zahlung für dein aktuelles Konto erneut."); };
        } });
        card.append(focus, el("a", { class: "abo-link-button", href: "/abo/mein-plan.html", text: "Abo-Status prüfen" }));
      }
      return;
    }
    paymentWindow?.discard();
    loading.textContent = "Zahlungsarten werden geladen …";
    await loadStripe();
    if (!requireCurrentAccount()) return;
    const price = publicConfig.plans[options.plan];
    const text = summaryText(options.plan, price, session.trialDays, session.firstYear);
    summary.textContent = text;
    short.textContent = text;
    terms.textContent = termsText(options.plan);
    trialNote.hidden = !(session.trialDays > 0);
    trialNote.textContent = session.trialDays > 0 ? `${session.trialDays} Tage kostenlos testen. Kündigst du vorher, zahlst du nichts.` : "";
    summary.parentElement.hidden = false;
    const stripe = window.Stripe(publicConfig.publishableKey, { locale: "de" });
    const appearance = { theme: "stripe", variables: { colorPrimary: "#47408c", colorText: "#1d1b24", colorBackground: "#ffffff", fontSizeBase: "16px", fontSizeSm: "14px", spacingUnit: "3px", borderRadius: "10px" } };
    const init = stripe.initCheckoutElementsSdk ?? stripe.initCheckout;
    checkout = await init.call(stripe, { clientSecret: session.clientSecret, elementsOptions: { appearance: { ...appearance, rules: { ".Input": { padding: "12px" }, ".Tab": { padding: "10px 8px" }, ".TabLabel": { fontSize: "14px" } } } } });
    if (!requireCurrentAccount()) return;
    const expressElement = checkout.createExpressCheckoutElement({ buttonType: { applePay: "subscribe", googlePay: "subscribe" } });
    expressElement.on("availablepaymentmethodschange", ({ paymentMethods }) => { divider.hidden = !paymentMethods || !Object.values(paymentMethods).some(Boolean); });
    expressElement.on("confirm", () => confirm());
    expressElement.mount(express);
    const paymentElement = checkout.createPaymentElement({ layout: "tabs", wallets: { link: "never" } });
    paymentElement.on("ready", () => {
      if (!sheet || sheet.node !== node) return;
      clearTimeout(loadingTimer);
      loading.hidden = true;
      payButton.hidden = false;
      payButton.disabled = false;
      options.track?.("checkout_sheet_ready");
    });
    paymentElement.on("loaderror", () => {
      if (!sheet || sheet.node !== node) return;
      clearTimeout(loadingTimer);
      loading.hidden = true;
      payButton.disabled = true;
      fail("Die Zahlungsarten konnten nicht geladen werden. Schließe die Kasse und öffne sie erneut.");
    });
    paymentElement.mount(payment);
  } catch (problem) {
    paymentWindow?.discard();
    clearTimeout(loadingTimer);
    loading.hidden = true;
    if (!sheet || sheet.node !== node) return;
    if (problem.code === "checkout_window_closed") {
      fail("Das Zahlungsfenster wurde geschlossen. Du kannst die Zahlung erneut öffnen.");
      card.append(el("button", { type: "button", class: "abo-button", text: "Erneut versuchen", onclick: () => { if (sheet?.node === node) open(options); } }));
      return;
    }
    if (problem.code === "checkout_account_changed") {
      fail("Dein Konto hat sich geändert. Öffne die Zahlung für dein aktuelles Konto erneut.");
      card.append(el("button", { type: "button", class: "abo-button", text: "Erneut versuchen",
        onclick: () => { if (sheet?.node === node) open({ ...options, email: auth?.currentUser?.email || undefined }); } }));
      return;
    }
    if (problem.code === "already_subscribed") {
      summary.textContent = "Du hast schon ein Abo. Dein Plan ist freigeschaltet.";
      summary.parentElement.hidden = false;
      payButton.replaceWith(el("a", { class: "abo-button", href: "/abo/mein-plan.html", text: "Zu deinem Plan" }));
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

export const isOpen = () => Boolean(sheet);
window.DemenzKasse = Object.freeze({ open, close, isOpen });
