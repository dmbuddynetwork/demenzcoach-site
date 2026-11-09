// Web-Kasse: Angebot wählen, mit demselben Firebase-Konto wie die App anmelden, über Stripe bezahlen.
// Netzwerk nur zu unserem Backend (DEMENZ_ABO_CONFIG.endpoint), zu Firebase Auth und zu Stripe.
import { createPaymentStatusController, paymentStatusText } from "./payment-status.js";
const config = window.DEMENZ_ABO_CONFIG;
const firebaseVersion = "12.16.0";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const state = {
  plan: params.get("plan") === "monthly" ? "monthly" : "yearly",
  source: (params.get("src") || "abo").replace(/[^a-z0-9_-]/giu, "").slice(0, 40),
  // Kampagne aus der Anzeige (utm_campaign über den Fragebogen): landet im Stripe-Abo, damit der Wert je Anzeige messbar ist.
  campaign: (params.get("c") || params.get("utm_campaign") || "").toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 60),
  offer: null,
  auth: null,
  firebase: null,
  user: null,
  checkout: null
};

const steps = ["plan", "account", "pay", "done", "already"];
function show(step) {
  for (const name of steps) $(`step-${name}`).hidden = name !== step;
  $("error").hidden = true;
  window.scrollTo({ top: 0 });
}
function fail(message) {
  $("error").textContent = message;
  $("error").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
// Messen nur über die gemeinsame Einwilligung der Website (lovable-home.js): GA4 mit Statistik-, Meta/TikTok mit
// Werbe-Einwilligung. Nie E-Mail, Name oder Telefonnummer senden.
const track = (name, values = {}, marketing = null) => {
  try { window.DemenzConsent?.track?.(name, values); } catch { /* ohne Einwilligung nichts */ }
  try { if (marketing) window.DemenzConsent?.trackMarketing?.(marketing.event, marketing.values); } catch { /* */ }
};

const euro = (cents, currency = "eur") => new Intl.NumberFormat("de-DE", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const dateText = (date) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(date);

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

// --- Schritt 1: Angebot ------------------------------------------------------------------------
function renderPlans() {
  for (const button of document.querySelectorAll("[data-plan]")) {
    button.setAttribute("aria-checked", String(button.dataset.plan === state.plan));
  }
  const trialDays = state.offer?.trialDays ?? 7;
  $("trial-note").hidden = trialDays === 0;
  $("trial-note").textContent = `${trialDays} Tage kostenlos. Jetzt wird nichts berechnet.`;
}
for (const button of document.querySelectorAll("[data-plan]")) {
  button.addEventListener("click", () => { state.plan = button.dataset.plan; renderPlans(); });
}
// Willkommenspreis aus dem Fragebogen (angebot.js): gilt nur, solange das signierte Angebot läuft.
const currentDeal = () => (state.offer?.offers ? window.DemenzAngebot?.current() ?? null : null);
function renderPrices() {
  const { yearly, monthly } = state.offer.plans;
  const deal = currentDeal();
  if (deal) {
    $("yearly-price").replaceChildren(Object.assign(document.createElement("s"), { textContent: euro(yearly.amount, yearly.currency) }),
      ` ${euro(deal.firstYear, yearly.currency)} im ersten Jahr inkl. MwSt.`);
    $("yearly-week").textContent = `danach ${euro(yearly.amount, yearly.currency)} pro Jahr inkl. MwSt. · Willkommenspreis fürs erste Jahr`;
  } else {
    $("yearly-price").textContent = `${euro(yearly.amount, yearly.currency)} pro Jahr inkl. MwSt.`;
    // Wie die umsatzstärksten Funnels: Preis pro Tag und ehrlicher Vergleich zum Monatspreis.
    $("yearly-week").textContent = `Nur ${euro(Math.round(yearly.amount / 365), yearly.currency)} am Tag · ${euro(Math.round(yearly.amount / 12), yearly.currency)} im Monat statt ${euro(monthly.amount, monthly.currency)}`;
  }
  $("monthly-price").textContent = `${euro(monthly.amount, monthly.currency)} pro Monat inkl. MwSt.`;
  // Nur ein belegbarer Vergleich (Jahrespreis gegenüber 12 Monatszahlungen), keine unbelegte Spitzenstellung („Beliebteste Wahl“, UWG § 5).
  const saving = Math.floor((1 - yearly.amount / (monthly.amount * 12)) * 20) * 5;
  $("yearly-badge").textContent = `Spare ${saving} %`;
  $("yearly-badge").hidden = saving < 10;
}
async function loadOffer() {
  try {
    state.offer = await api("/config");
    renderPrices();
    renderPlans();
  } catch {
    fail("Die Angebote laden gerade nicht. Bitte versuch es gleich noch einmal.");
  }
}
$("plan-next").addEventListener("click", async () => {
  track("begin_checkout", { plan: state.plan, source: state.source }, { event: "InitiateCheckout" });
  await ensureFirebase();
  if (state.user) return goToPay();
  // Wie Noom und BetterMe: erst bezahlen, Konto danach. Ein stilles Gast-Konto trägt den Kauf, die Nummer kommt auf der Danke-Seite dazu.
  try {
    state.user = (await state.firebase.signInAnonymously(state.auth)).user;
    track("sign_up", { method: "guest" });
    return goToPay();
  } catch {
    show("account");
  }
});
$("have-account").addEventListener("click", () => show("account"));
for (const back of document.querySelectorAll("[data-back]")) back.addEventListener("click", () => show(back.dataset.back));

// --- Schritt 2: Konto (Firebase Auth, dasselbe Projekt wie die App) ---------------------------------
async function ensureFirebase() {
  if (state.auth) return state.auth;
  if (!config.firebase.apiKey) {
    fail("Die Anmeldung ist noch nicht eingerichtet.");
    throw new Error("firebase not configured");
  }
  const [{ initializeApp }, auth] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`)
  ]);
  state.firebase = auth;
  state.auth = auth.getAuth(initializeApp(config.firebase));
  state.auth.languageCode = "de";
  await auth.getRedirectResult(state.auth).catch(() => null);
  await new Promise((resolve) => {
    const stop = auth.onAuthStateChanged(state.auth, (user) => { state.user = user; stop(); resolve(); });
  });
  auth.onAuthStateChanged(state.auth, (user) => { state.user = user; $("manage-button").hidden = !user; });
  return state.auth;
}

$("apple-button").addEventListener("click", async () => {
  try {
    await ensureFirebase();
    const provider = new state.firebase.OAuthProvider("apple.com");
    provider.addScope("email");
    provider.setCustomParameters({ locale: "de_DE" });
    try {
      state.user = (await state.firebase.signInWithPopup(state.auth, provider)).user;
    } catch (error) {
      if (error?.code !== "auth/popup-blocked") throw error;
      return state.firebase.signInWithRedirect(state.auth, provider);
    }
    track("sign_up", { method: "apple" });
    goToPay();
  } catch (error) {
    if (error?.code !== "auth/popup-closed-by-user" && error?.code !== "auth/cancelled-popup-request") {
      fail("Die Anmeldung mit Apple hat nicht geklappt. Bitte versuch es noch einmal.");
    }
  }
});

// Ohne Apple-Services-ID: nur die Telefonnummer zeigen, das Formular gleich offen.
if (!config.signIn?.apple) {
  $("apple-button").hidden = true;
  $("phone-toggle").hidden = true;
  $("phone-form").hidden = false;
}

$("phone-toggle").addEventListener("click", () => {
  $("phone-form").hidden = false;
  $("phone").focus();
});
let phoneConfirmation;
let recaptcha;
$("phone-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = $("phone").value.replace(/[\s/()-]/gu, "");
  const phone = raw.startsWith("00") ? `+${raw.slice(2)}` : raw.startsWith("0") ? `+49${raw.slice(1)}` : raw;
  if (!/^\+\d{8,15}$/u.test(phone)) return fail("Bitte gib deine Telefonnummer mit Vorwahl ein, zum Beispiel +49 170 1234567.");
  try {
    await ensureFirebase();
    recaptcha ??= new state.firebase.RecaptchaVerifier(state.auth, "recaptcha", { size: "invisible" });
    phoneConfirmation = await state.firebase.signInWithPhoneNumber(state.auth, phone, recaptcha);
    $("code-block").hidden = false;
    $("code").focus();
  } catch {
    fail("Die SMS konnte nicht geschickt werden. Prüf bitte die Nummer.");
  }
});
$("code-confirm").addEventListener("click", async () => {
  try {
    state.user = (await phoneConfirmation.confirm($("code").value.trim())).user;
    track("sign_up", { method: "phone" });
    goToPay();
  } catch {
    fail("Der Code stimmt nicht. Bitte prüf ihn noch einmal.");
  }
});

// --- Schritt 3: Bezahlen -------------------------------------------------------------------------
function goToPay() {
  show("pay");
  const who = state.user.isAnonymous ? "" : (state.user.email || state.user.phoneNumber || "");
  $("signed-in-as").textContent = who ? `Angemeldet als ${who}` : "";
  if (state.user.email) return startCheckout();
  $("email-block").hidden = false;
  $("pay-block").hidden = true;
  // E-Mail aus dem Fragebogen (nur in diesem Tab gemerkt) vorausfüllen.
  try { if (!$("email").value) $("email").value = sessionStorage.getItem("demenzCoachEmail") || ""; } catch { /* */ }
}
$("email-next").addEventListener("click", () => {
  const email = $("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return fail("Bitte gib eine gültige E-Mail-Adresse ein.");
  startCheckout(email);
});

async function startCheckout(email) {
  $("email-block").hidden = true;
  $("pay-block").hidden = false;
  $("pay-button").disabled = true;
  try {
    const token = await state.user.getIdToken();
    const deal = state.plan === "yearly" && currentDeal() ? window.DemenzAngebot.forCheckout() : null;
    await window.DemenzTeller?.ready;
    const session = await api("/session", {
      method: "POST",
      token,
      body: { plan: state.plan, termsVersion: state.offer?.textVersions?.terms, source: state.source, campaign: state.campaign,
        ...window.DemenzTeller?.attribution(),
        ...(deal ? { offer: deal } : {}), ...(email ? { email } : {}) }
    });
    renderSummary(session.trialDays, session.firstYear);
    await mountStripe(session.clientSecret);
  } catch (error) {
    if (error.code === "already_subscribed") return show("already");
    if (error.code === "offer_expired" || error.code === "invalid_offer") {
      const deal = window.DemenzAngebot?.current();
      if (deal) window.DemenzAngebot.drop(deal.kind);
      renderPrices();
      show("plan");
      return fail("Der Sonderpreis ist abgelaufen. Es gilt jetzt der normale Preis. Tippe noch einmal auf Weiter.");
    }
    if (error.code === "terms_outdated") return fail("Die Seite ist nicht mehr aktuell. Bitte lade sie neu.");
    if (error.code === "email_required") {
      $("email-block").hidden = false;
      $("pay-block").hidden = true;
      return fail("Bitte gib eine gültige E-Mail-Adresse ein.");
    }
    fail("Die Zahlung kann gerade nicht starten. Bitte versuch es gleich noch einmal.");
  }
}

// § 312j Abs. 2 BGB und Art. 246a § 1 EGBGB: Gesamtpreis inkl. Steuern, Laufzeit und Kündigungsbedingungen stehen
// vor den Zahlungsknöpfen und noch einmal direkt über dem Bestellknopf; mit Sonderpreis fürs erste Jahr, wenn die Kasse ihn bestätigt hat.
function renderSummary(trialDays, firstYear = null) {
  const price = state.offer?.plans?.[state.plan];
  const priceText = price ? `${euro(price.amount, price.currency)} pro ${state.plan === "yearly" ? "Jahr" : "Monat"}` : "";
  const deal = Number.isInteger(firstYear) && price ? euro(firstYear, price.currency) : null;
  let summary;
  if (trialDays > 0) {
    const start = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    summary = deal
      ? `Heute 0,00 €. Ab ${dateText(start)} ${deal} für das erste Jahr, danach ${priceText}, jeweils inklusive MwSt. Kündigst du vorher, zahlst du nichts.`
      : `Heute 0,00 €. Ab ${dateText(start)} ${priceText} inklusive MwSt. Kündigst du vorher, zahlst du nichts.`;
  } else {
    summary = deal
      ? `Heute ${deal} für das erste Jahr, danach ${priceText}, jeweils inklusive MwSt.`
      : `Heute ${priceText.replace(" pro ", " für 1 ")} inklusive MwSt. Danach ${priceText}.`;
  }
  $("pay-summary").textContent = summary;
  $("pay-summary-short").textContent = summary;
  $("pay-terms").textContent = state.plan === "yearly"
    ? "Laufzeit: 1 Jahr. Danach läuft das Abo unbefristet weiter und ist mit einer Frist von einem Monat kündbar."
    : "Das Abo verlängert sich jeden Monat automatisch und ist jederzeit zum Monatsende kündbar.";
}

// Stripe.js erst laden, wenn jemand wirklich bezahlen will (nicht schon beim Betrachten der Angebote).
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

async function mountStripe(clientSecret) {
  await loadStripe();
  const stripe = window.Stripe(state.offer.publishableKey, { locale: "de" });
  const appearance = {
    theme: "stripe",
    variables: { colorPrimary: "#47408c", colorText: "#1d1b24", colorBackground: "#ffffff", fontSizeBase: "16px", fontSizeSm: "14px", spacingUnit: "3px", borderRadius: "10px" }
  };
  const init = stripe.initCheckoutElementsSdk ?? stripe.initCheckout;
  state.checkout = await init.call(stripe, { clientSecret, elementsOptions: { appearance: { ...appearance, rules: { ".Input": { padding: "12px" }, ".Tab": { padding: "10px 8px" }, ".TabLabel": { fontSize: "14px" } } } } });
  const express = state.checkout.createExpressCheckoutElement({ buttonType: { applePay: "subscribe", googlePay: "subscribe" } });
  express.on("availablepaymentmethodschange", ({ paymentMethods }) => {
    $("express-divider").hidden = !paymentMethods || !Object.values(paymentMethods).some(Boolean);
  });
  express.on("confirm", () => confirmPayment());
  express.mount("#express-checkout");
  const payment = state.checkout.createPaymentElement({ layout: "tabs" });
  payment.on("ready", () => { $("pay-button").disabled = false; });
  payment.on("loaderror", () => {
    $("pay-button").disabled = true;
    fail("Die Zahlungsarten konnten nicht geladen werden. Wähle dein Angebot bitte erneut.");
  });
  payment.mount("#payment-element");
}

async function confirmPayment() {
  $("pay-button").disabled = true;
  try {
    const loaded = await state.checkout.loadActions?.();
    const actions = loaded?.actions ?? state.checkout;
    const result = await actions.confirm();
    if (result?.type === "error" || result?.error) {
      fail(result.error?.message || "Die Zahlung hat nicht geklappt.");
      $("pay-button").disabled = false;
    }
  } catch {
    fail("Die Zahlung hat nicht geklappt. Bitte versuch es noch einmal.");
    $("pay-button").disabled = false;
  }
}
$("pay-button").addEventListener("click", confirmPayment);

// --- Konto nach dem Kauf: Gast-Konto bekommt die Telefonnummer (UID und damit Stripe/Adapty-Zuordnung bleiben gleich) ----
let linkConfirmation;
let linkRecaptcha;
async function offerAccountLink() {
  try {
    await ensureFirebase();
    if (!state.user?.isAnonymous) return;
    $("link-card").hidden = false;
    track("account_link_shown", { source: state.source });
  } catch { /* Konto später im Plan nachholbar */ }
}
$("link-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = $("link-phone").value.replace(/[\s/()-]/gu, "");
  const phone = raw.startsWith("00") ? `+${raw.slice(2)}` : raw.startsWith("0") ? `+49${raw.slice(1)}` : raw;
  if (!/^\+\d{8,15}$/u.test(phone)) return fail("Bitte gib deine Telefonnummer mit Vorwahl ein, zum Beispiel +49 170 1234567.");
  try {
    linkRecaptcha ??= new state.firebase.RecaptchaVerifier(state.auth, "link-recaptcha", { size: "invisible" });
    linkConfirmation = await state.firebase.linkWithPhoneNumber(state.user, phone, linkRecaptcha);
    $("link-code-block").hidden = false;
    $("link-code").focus();
  } catch (error) {
    fail(error?.code === "auth/credential-already-in-use"
      ? "Diese Nummer hat schon ein App-Konto. Schreib uns bitte kurz über das Kontaktformular, wir verbinden dein Abo."
      : "Die SMS konnte nicht geschickt werden. Prüf bitte die Nummer.");
  }
});
$("link-confirm").addEventListener("click", async () => {
  try {
    state.user = (await linkConfirmation.confirm($("link-code").value.trim())).user;
    track("account_linked", { source: state.source });
    $("link-card").hidden = true;
  } catch (error) {
    fail(error?.code === "auth/credential-already-in-use"
      ? "Diese Nummer hat schon ein App-Konto. Schreib uns bitte kurz über das Kontaktformular, wir verbinden dein Abo."
      : "Der Code stimmt nicht. Bitte prüf ihn noch einmal.");
  }
});

// --- Abo verwalten (Stripe-Kundenportal) ----------------------------------------------------------
async function openPortal() {
  try {
    await ensureFirebase();
    if (!state.user) return show("account");
    const { url } = await api("/portal", { method: "POST", token: await state.user.getIdToken() });
    location.href = url;
  } catch {
    fail("Die Abo-Verwaltung öffnet gerade nicht. Kündigen geht immer über „Verträge hier kündigen“ unten.");
  }
}
$("manage-button").addEventListener("click", openPortal);
for (const button of document.querySelectorAll("[data-manage]")) button.addEventListener("click", openPortal);

// Direkt nach dem Kauf (wie die umsatzstärksten Funnels mit ihrem Upsell): Monatskunden bekommen einmal das
// Jahresabo angeboten. Der Wechsel läuft im Stripe-Kundenportal, mit Preis und Bestätigung dort; die Probezeit bleibt.
async function offerYearlySwitch() {
  try {
    await ensureFirebase();
    if (!state.user) return;
    const token = await state.user.getIdToken();
    const entitlement = await api("/entitlement", { token });
    if (!entitlement.active || entitlement.plan !== "monthly") return;
    const offer = state.offer || await api("/config").catch(() => null);
    const yearly = offer?.plans?.yearly;
    const monthly = offer?.plans?.monthly;
    const saving = yearly && monthly ? Math.floor((1 - yearly.amount / (monthly.amount * 12)) * 20) * 5 : 0;
    const card = document.createElement("div");
    card.className = "abo-card abo-upgrade";
    const title = document.createElement("p");
    title.innerHTML = "<strong></strong>";
    title.firstChild.textContent = saving >= 10 ? `Jahresabo statt Monat: spare ${saving} %` : "Lieber das Jahresabo?";
    const text = document.createElement("p");
    text.className = "abo-muted";
    text.textContent = yearly ? `${euro(yearly.amount, yearly.currency)} im Jahr statt ${euro(monthly.amount * 12, monthly.currency)} bei monatlicher Zahlung, jeweils inkl. MwSt. Den Preis für den Wechsel siehst du vor der Bestätigung.` : "Den Preis für den Wechsel siehst du vor der Bestätigung.";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "abo-button";
    button.textContent = "Zum Jahresabo wechseln";
    button.addEventListener("click", async () => {
      button.disabled = true;
      track("upgrade_yearly_click", { source: state.source });
      try {
        const { url } = await api("/switch-yearly", { method: "POST", token: await state.user.getIdToken() });
        location.href = url;
      } catch {
        button.disabled = false;
        fail("Der Wechsel geht gerade nicht. Du kannst ihn später unter „Abo verwalten“ machen.");
      }
    });
    card.append(title, text, button);
    $("step-done").querySelector(".abo-card")?.after(card);
    track("upgrade_yearly_shown", { source: state.source });
  } catch { /* Angebot ist ein Extra */ }
}

// Kam jemand vom Übersetzer (Angebotskarte, ki-freigabe.js), führt der erste Knopf dorthin zurück.
// Dort wartet der zuletzt eingegebene Satz (nur in diesem Tab gemerkt).
function translatorReturn() {
  let path = "";
  try { path = String(JSON.parse(localStorage.getItem("demenzCoachKi") || "{}").returnTo || ""); } catch { /* */ }
  if (!/^\/[A-Za-z0-9/_.-]{0,120}$/u.test(path) || path.startsWith("//")) return;
  for (const section of ["step-done", "step-already"]) {
    const link = document.createElement("a");
    link.className = "abo-button";
    link.href = path;
    link.textContent = "Zurück zum Übersetzer";
    const first = $(section).querySelector(".abo-button");
    first?.classList.add("abo-button-light");
    $(section).insertBefore(link, first);
  }
}

// --- Start ---------------------------------------------------------------------------------------
$("app-store-link").href = config.appStoreURL;
translatorReturn();
if (params.get("status") === "fertig") {
  show("done");
  let portalAvailable = false;
  const checkStatus = createPaymentStatusController({
    sessionID: params.get("session_id"),
    loadStatus: async (sessionID) => {
      await ensureFirebase();
      if (!state.user) throw new Error("sign_in_required");
      const token = await state.user.getIdToken();
      portalAvailable = true;
      // Das eigene Firebase-Gastkonto sichern, unabhängig vom Zahlungsstatus.
      // Es wird keine Kundenzuordnung aus einer öffentlichen Session übernommen.
      if (state.user.isAnonymous && $("link-card").hidden) await offerAccountLink();
      return api(`/session-status?session_id=${encodeURIComponent(sessionID)}`, { token });
    },
    render: (outcome) => {
      const active = ["paid", "trialing", "no_payment_due"].includes(outcome);
      const [title, text] = paymentStatusText[outcome];
      $("done-title").textContent = title;
      $("done-status").textContent = text;
      $("done-plan").hidden = !active;
      $("done-plan-link").hidden = !active;
      $("app-store-link").hidden = !active;
      $("payment-status-manage").hidden = !portalAvailable || active || outcome === "checking";
      $("payment-status-retry").hidden = active;
      $("payment-status-retry").disabled = outcome === "checking";
    },
    activate: () => { offerYearlySwitch(); }
  });
  $("payment-status-retry").addEventListener("click", checkStatus);
  checkStatus();
} else if (params.get("weiter") === "1") {
  // Vom Fragebogen (/start/): Angebot ist dort schon gewählt, direkt zum Konto.
  show("account");
  renderPlans();
  loadOffer();
  $("plan-next").click();
} else {
  show("plan");
  renderPlans();
  loadOffer();
}
