// Web-Kasse: Angebot wählen, mit demselben Firebase-Konto wie die App anmelden, über Stripe bezahlen.
// Netzwerk nur zu unserem Backend (DEMENZ_ABO_CONFIG.endpoint), zu Firebase Auth und zu Stripe.
import { createPaymentStatusController, paymentStatusText } from "./payment-status.js";
import { emailAccountURL } from "./email-auth.js";
import { createHostedCheckoutRedirect, reserveCheckoutWindow } from "./checkout-redirect.js";
const redirectHostedCheckout = createHostedCheckoutRedirect((url, attempt) => {
  if (attempt?.paymentWindow) attempt.paymentWindow.navigate(url);
  else location.assign(url);
});
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
  checkoutAttempt: null,
  checkoutGeneration: 0,
  step: "plan"
};

const steps = ["plan", "account", "pay", "done", "already"];
function invalidateCheckout() {
  state.checkoutAttempt?.paymentWindow?.discard();
  state.checkoutGeneration += 1;
  state.checkoutAttempt = null;
  $("hosted-checkout-status").hidden = true;
  $("hosted-checkout-retry").hidden = true;
}
function currentAttempt(attempt) {
  return state.checkoutAttempt === attempt && attempt?.generation === state.checkoutGeneration
    && attempt.plan === state.plan && attempt.user === state.user && state.step === "pay" && !$("step-pay").hidden;
}
function show(step) {
  invalidateCheckout();
  state.step = step;
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
const dateText = (date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

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
  renderQuick();
}
for (const button of document.querySelectorAll("[data-plan]")) {
  button.addEventListener("click", () => { invalidateCheckout(); state.plan = button.dataset.plan; renderPlans(); });
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
    // Daniel, 24. Nov 2026: kein eigenes Zahlungsformular. Die Zahlung läuft immer auf der gehosteten Stripe-Seite.
    renderPrices();
    renderPlans();
  } catch {
    fail("Die Angebote laden gerade nicht. Bitte versuch es gleich noch einmal.");
  }
}
$("plan-next").addEventListener("click", async () => {
  if (currentAttempt(state.checkoutAttempt)) { state.checkoutAttempt.paymentWindow?.focus(); return; }
  const preparedWindow = state.user?.email ? reserveCheckoutWindow(window) : undefined;
  track("begin_checkout", { plan: state.plan, source: state.source }, { event: "InitiateCheckout" });
  try {
    await ensureFirebase();
    if (state.user) return goToPay(preparedWindow);
    // Das Gast-Konto trägt den Kauf; ein E-Mail-Zugang kann danach verknüpft werden.
    state.user = (await state.firebase.signInAnonymously(state.auth)).user;
    track("sign_up", { method: "guest" });
    return goToPay();
  } catch {
    preparedWindow?.discard();
    refreshEmailEntry(); show("account");
  }
});
$("have-account").addEventListener("click", () => { refreshEmailEntry(); show("account"); });
for (const back of document.querySelectorAll("[data-back]")) back.addEventListener("click", () => show(back.dataset.back));

// --- Apple-Pay-Vorfahrt (Test, nur mit ?ap=1) -----------------------------------------------------
// Wie Tolan: Auf dem iPhone steht der Apple-Pay-Knopf schon auf der Angebotsseite, ein Tipp öffnet das Apple-Pay-Fenster.
// Es ist nur der Express-Knopf von Stripe, kein Kartenformular (Daniel, 24. Nov 2026). Preis, Laufzeit und Kündigung stehen
// direkt über dem Knopf (§ 312j BGB). Alle anderen Geräte und Zahlarten gehen wie bisher über die gehostete Stripe-Seite.
const quick = { enabled: params.get("ap") === "1", slots: {}, timer: null, dead: false };
const quickSupported = () => { try { return window.ApplePaySession?.canMakePayments?.() === true; } catch { return false; } };
function loadStripe() {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/dahlia/stripe.js"; // gleiche Version wie die Checkout-Session (ui_mode elements)
    script.onload = resolve;
    script.onerror = () => reject(new Error("stripe.js failed"));
    document.head.append(script);
  });
}
function quickSummary(plan, trialDays, firstYear) {
  const price = state.offer?.plans?.[plan];
  if (!price) return "";
  const period = plan === "yearly" ? "Jahr" : "Monat";
  const recurring = `${euro(price.amount, price.currency)}/${period}`;
  const deal = Number.isInteger(firstYear) ? euro(firstYear, price.currency) : null;
  const terms = plan === "yearly" ? "1 Jahr Mindestlaufzeit; danach unbefristet, mit 1 Monat Kündigungsfrist." : "Verlängert sich monatlich; jederzeit zum Monatsende kündbar.";
  if (trialDays > 0) {
    const start = new Date(Date.now() + trialDays * 86_400_000);
    return `${deal ? `Heute 0,00 €. Ab ${dateText(start)}: ${deal} im 1. Jahr, danach ${recurring}.` : `Heute 0,00 €. Ab ${dateText(start)}: ${recurring}.`} Inkl. MwSt. ${terms}`;
  }
  return `${deal ? `Heute ${deal} im 1. Jahr, danach ${recurring}.` : `Heute ${euro(price.amount, price.currency)}, danach ${recurring}.`} Inkl. MwSt. ${terms}`;
}
function hideQuick() {
  quick.dead = true;
  $("quick-pay").hidden = true;
  $("plan-next").textContent = "Weiter";
}
function renderQuick() {
  if (!quick.enabled || quick.dead || !state.offer || !quickSupported()) return;
  $("quick-pay").hidden = false;
  $("plan-next").textContent = "Mit Karte oder PayPal weiter";
  for (const plan of ["yearly", "monthly"]) $(`quick-slot-${plan}`).hidden = plan !== state.plan;
  const deal = state.plan === "yearly" && currentDeal();
  $("quick-summary").textContent = quickSummary(state.plan, state.offer.trialDays ?? 7, deal ? deal.firstYear : null);
  clearTimeout(quick.timer);
  quick.timer = setTimeout(() => mountQuick(state.plan), 400);
}
async function mountQuick(plan) {
  if (quick.slots[plan] || quick.dead) return;
  quick.slots[plan] = { pending: true };
  try {
    await ensureFirebase();
    // Das Gast-Konto trägt den Kauf, wie beim Weiter-Knopf.
    if (!state.user) state.user = (await state.firebase.signInAnonymously(state.auth)).user;
    const user = state.user;
    const token = await user.getIdToken();
    const deal = plan === "yearly" && currentDeal() ? window.DemenzAngebot.forCheckout() : null;
    await window.DemenzTeller?.ready;
    const session = await api("/session", {
      method: "POST",
      token,
      body: { plan, termsVersion: state.offer?.textVersions?.terms, source: state.source, campaign: state.campaign,
        ...window.DemenzTeller?.attribution(),
        ...(state.offer?.walletEmail === true ? { emailLater: true } : {}), ...(deal ? { offer: deal } : {}) }
    });
    if (!session.clientSecret) throw new Error("no_client_secret");
    await loadStripe();
    const stripe = window.Stripe(state.offer.publishableKey, { locale: "de" });
    const init = stripe.initCheckoutElementsSdk ?? stripe.initCheckout;
    const checkout = await init.call(stripe, { clientSecret: session.clientSecret, elementsOptions: { appearance: { theme: "stripe", variables: { colorPrimary: "#47408c", borderRadius: "10px" } } } });
    const express = checkout.createExpressCheckoutElement({
      buttonType: { applePay: "subscribe" }, buttonHeight: 52, layout: { maxColumns: 1, maxRows: 1, overflow: "never" },
      paymentMethods: { applePay: "always", googlePay: "never", link: "never", paypal: "never", amazonPay: "never", klarna: "never" }
    });
    express.on("availablepaymentmethodschange", ({ paymentMethods }) => {
      if (!paymentMethods || !paymentMethods.applePay) hideQuick();
      else track("apple_pay_quick_shown", { plan, source: state.source });
    });
    express.on("confirm", async () => {
      track("apple_pay_quick_confirm", { plan, source: state.source });
      try {
        const loaded = await checkout.loadActions?.();
        const result = await (loaded?.actions ?? checkout).confirm();
        if (result?.type === "error" || result?.error) fail(result.error?.message || "Die Zahlung hat nicht geklappt.");
      } catch {
        fail("Die Zahlung hat nicht geklappt. Bitte versuch es noch einmal.");
      }
    });
    express.mount($(`quick-slot-${plan}`));
  } catch (error) {
    delete quick.slots[plan];
    // Rate-Limit, bereits ein Abo oder ein Fehler: still auf den normalen Weg zurück, nichts blockieren.
    hideQuick();
    if (error?.code === "already_subscribed") show("already");
  }
}

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

// Email is the only new web registration path. Existing identity providers
// remain on the Firebase account; this does not delete native/legacy accounts.
if (!config.signIn?.apple) $("apple-button").hidden = true;
function emailReturn() {
  if (params.get("status") === "fertig") return `/abo/${location.search}`;
  const query = new URLSearchParams({ plan: state.plan, src: state.source, weiter: "1" });
  if (state.campaign) query.set("c", state.campaign);
  return `/abo/?${query}`;
}
function refreshEmailEntry() {
  $("email-login").href = emailAccountURL(emailReturn(), location.origin, "signin");
}
$("email-login").addEventListener("click", refreshEmailEntry);
refreshEmailEntry();

// --- Schritt 3: Bezahlen -------------------------------------------------------------------------
function goToPay(preparedWindow) {
  if (currentAttempt(state.checkoutAttempt)) {
    if (preparedWindow !== state.checkoutAttempt.paymentWindow) preparedWindow?.discard();
    state.checkoutAttempt.paymentWindow?.focus();
    return;
  }
  show("pay");
  if (state.user.email) return startCheckout(undefined, preparedWindow);
  preparedWindow?.discard();
  $("email-block").hidden = false;
  // E-Mail aus dem Fragebogen (nur in diesem Tab gemerkt) vorausfüllen.
  try { if (!$("email").value) $("email").value = sessionStorage.getItem("demenzCoachEmail") || ""; } catch { /* */ }
}
$("email-next").addEventListener("click", () => {
  const email = $("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return fail("Bitte gib eine gültige E-Mail-Adresse ein.");
  startCheckout(email);
});

async function startCheckout(email, preparedWindow) {
  if (currentAttempt(state.checkoutAttempt)) {
    if (preparedWindow !== state.checkoutAttempt.paymentWindow) preparedWindow?.discard();
    state.checkoutAttempt.paymentWindow?.focus();
    return;
  }
  invalidateCheckout();
  const paymentWindow = preparedWindow !== undefined ? preparedWindow : reserveCheckoutWindow(window);
  const attempt = { generation: state.checkoutGeneration, plan: state.plan, user: state.user, paymentWindow };
  state.checkoutAttempt = attempt;
  $("email-block").hidden = true;
  $("hosted-checkout-status").hidden = false;
  try {
    const token = await attempt.user.getIdToken();
    if (!currentAttempt(attempt)) throw new Error("checkout_attempt_changed");
    const deal = attempt.plan === "yearly" && currentDeal() ? window.DemenzAngebot.forCheckout() : null;
    await window.DemenzTeller?.ready;
    if (!currentAttempt(attempt)) throw new Error("checkout_attempt_changed");
    const session = await api("/session", {
      method: "POST",
      token,
      body: { plan: attempt.plan, checkoutMode: "hosted", hostedFallback: true, termsVersion: state.offer?.textVersions?.terms, source: state.source, campaign: state.campaign,
        ...window.DemenzTeller?.attribution(),
        ...(deal ? { offer: deal } : {}), ...(email ? { email } : {}) }
    });
    if (!currentAttempt(attempt)) throw new Error("checkout_attempt_changed");
    if (redirectHostedCheckout(session, { attempt, isCurrent: () => currentAttempt(attempt) })) {
      if (paymentWindow) {
        $("hosted-checkout-status").textContent = "Die sichere Zahlung ist in einem neuen Fenster geöffnet. Den Zahlungsstatus kannst du unter Abo verwalten prüfen.";
        const focus = $("hosted-checkout-retry");
        focus.hidden = false;
        focus.textContent = "Zahlungsfenster anzeigen";
        focus.onclick = () => {
          if (!currentAttempt(attempt)) return;
          if (paymentWindow.focus()) return;
          // COOP may sever the window reference even while Stripe stays open.
          // Reuse this exact session; never create a second one just to refocus.
          fail("Das Zahlungsfenster lässt sich hier nicht erneut anzeigen. Du kannst dieselbe Zahlung in diesem Tab öffnen oder den Status unter Abo verwalten prüfen.");
          focus.textContent = "Zahlung in diesem Tab öffnen";
          focus.onclick = () => { if (currentAttempt(attempt)) location.assign(session.url); };
        };
      }
      return;
    }
    throw new Error("hosted_checkout_unavailable");
  } catch (error) {
    paymentWindow?.discard();
    if (!currentAttempt(attempt)) {
      if (state.checkoutAttempt === attempt && state.step === "pay") {
        invalidateCheckout();
        fail("Dein Konto hat sich geändert. Öffne die Zahlung für dein aktuelles Konto erneut.");
        const retry = $("hosted-checkout-retry");
        retry.hidden = false;
        retry.textContent = "Zahlung erneut öffnen";
        retry.onclick = () => goToPay();
      }
      return;
    }
    invalidateCheckout();
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
      return fail("Bitte gib eine gültige E-Mail-Adresse ein.");
    }
    const retry = $("hosted-checkout-retry");
    retry.textContent = "Erneut versuchen";
    retry.hidden = false;
    retry.onclick = () => {
      if (state.user === attempt.user && state.plan === attempt.plan && state.step === "pay") startCheckout(email);
    };
    fail(error.code === "checkout_window_closed" ? "Das Zahlungsfenster wurde geschlossen. Du kannst die Zahlung erneut öffnen." : "Die Zahlung kann gerade nicht starten. Bitte versuch es gleich noch einmal.");
  }
}

// Preserve the paid guest UID by linking email in the same Firebase account.
async function offerAccountLink() {
  try {
    await ensureFirebase();
    if (!state.user || state.user.emailVerified) return;
    $("email-link-after").href = emailAccountURL(emailReturn(), location.origin, "link");
    $("link-card").hidden = false;
    track("account_link_shown", { source: state.source });
  } catch { /* The verified account can be recovered through support. */ }
}

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
    link.textContent = /gespraeche-ueben|practice-conversations/u.test(path) ? "Zurück zum Üben" : "Zurück zum Übersetzer";
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
      if (!state.user.emailVerified && $("link-card").hidden) await offerAccountLink();
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
