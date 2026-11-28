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
// Englische Seiten (lang="en", Daniel 28. Nov 2026: englische Startseite): Texte dieses Fensters auf Englisch, deutsche Seiten unverändert.
const EN = /^en(?:-|$)/iu.test(document.documentElement.lang || "");
const t = (de, en) => (EN ? en : de);
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
  auth.languageCode = EN ? "en" : "de";
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
const euro = (cents) => new Intl.NumberFormat(EN ? "en-US" : "de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
function termsFor(session) {
  // Bezahlte Probewoche (27. Nov 2026, Server-Tarif „probe“): Monatspreis mit 7 Tagen für 1,00 €. Wer schon getestet hat,
  // bekommt vom Server trialFee 0 und das normale Monatsabo; dann gelten die Monats-Texte.
  if (session?.plan === "probe") {
    const monthly = publicConfig?.plans?.monthly?.amount;
    if (!Number.isFinite(monthly)) return "";
    const monthlyTerms = t(`${euro(monthly)} pro Monat inkl. MwSt. Verlängert sich monatlich, jederzeit zum Monatsende kündbar.`,
      `${euro(monthly)} a month incl. VAT. Renews monthly, cancel anytime effective at the end of the month.`);
    if (!(session.trialFee > 0) || !(session.trialDays > 0)) return monthlyTerms;
    return t(`${session.trialDays} Tage für ${euro(session.trialFee)}, dann ${monthlyTerms} Kündigst du vorher, zahlst du nur die Probewoche.`,
      `${session.trialDays} days for ${euro(session.trialFee)}, then ${monthlyTerms} If you cancel before, you only pay for the trial week.`);
  }
  const amount = publicConfig?.plans?.[session?.plan]?.amount;
  if (!Number.isFinite(amount)) return "";
  const trial = session.trialDays > 0 ? t(`${session.trialDays} Tage kostenlos, dann `, `${session.trialDays} days free, then `) : "";
  const noCharge = trial ? t(" Kündigst du vorher, zahlst du nichts.", " If you cancel before, you pay nothing.") : "";
  if (session.plan === "yearly") {
    const first = Number.isFinite(session.firstYear) ? session.firstYear : amount;
    const price = first !== amount ? t(`${euro(first)} im ersten Jahr, danach ${euro(amount)} pro Jahr`, `${euro(first)} for the first year, then ${euro(amount)} a year`)
      : t(`${euro(amount)} pro Jahr`, `${euro(amount)} a year`);
    return `${trial}${price}${t(" inkl. MwSt. 1 Jahr Mindestlaufzeit, danach unbefristet mit 1 Monat Kündigungsfrist.", " incl. VAT. 1-year minimum term, then ongoing with 1 month’s notice.")}${noCharge}`;
  }
  return `${trial}${euro(amount)}${t(" pro Monat inkl. MwSt. Verlängert sich monatlich, jederzeit zum Monatsende kündbar.", " a month incl. VAT. Renews monthly, cancel anytime effective at the end of the month.")}${noCharge}`;
}

// Tempo (Daniel, 26. Nov 2026: die Zahlung muss sofort kommen): Konto, Konfiguration und die Stripe-Sitzung werden schon
// vorbereitet, wenn die Angebotsseite erscheint. Der Klick leitet dann ohne Wartezeit weiter. Unbezahlte Sitzungen verfallen nach 24 Stunden.
const PREPARED_MAX_AGE = 15 * 60_000;
const preparedSessions = new Map();
// Handy (unter 900 px): alle Kaufknöpfe führen auf Stripes eigene Seite (Daniel, 26. Nov 2026: „Ja, alle am Handy zu Stripe“,
// vorher nur der Link „Mit Karte oder anderer Zahlart bezahlen“). Am Desktop bleibt es beim Layer mit Stripes Formular.
const toStripePage = () => hostWindow().matchMedia?.("(min-width: 900px)")?.matches === false;
// Messung (27. Nov 2026): Anzeige/Reel (utm_content, aus ?a= über kampagne-utm.js) und Testlauf-Merkmal gehen als Kürzel mit in die
// Stripe-Sitzung. So lassen sich Käufe je Reel zählen und Testkäufe (?src=test, Merkzeichen von /intern/) herausfiltern.
function measureFields() {
  let search = location.search;
  try { search = hostWindow().location.search || search; } catch { /* fremder Rahmen */ }
  const params = new URLSearchParams(search);
  const ad = String(params.get("utm_content") || params.get("a") || "").toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 60);
  let test = [params.get("src"), params.get("utm_source")].some((value) => String(value || "").trim().toLowerCase() === "test");
  try { test ||= localStorage.getItem("demenzcoach.internal.v1") === "1"; } catch { /* privater Modus */ }
  return { ...(ad ? { ad } : {}), ...(test ? { test: true } : {}) };
}
function sessionBody(options) {
  const stripePage = toStripePage(options);
  return { plan: options.plan, termsVersion: publicConfig.textVersions?.terms, source: options.source, campaign: options.campaign,
    ...window.DemenzTeller?.attribution(),
    ...measureFields(),
    ...window.DemenzConsent?.metaContext?.(),
    hostedFallback: true,
    // Stripes eingebettete Zahlungsseite im Layer, wenn der Server sie anbietet (Daniel, 26. Nov 2026). Ältere Server ignorieren das Feld und liefern die gehostete Seite.
    ...(publicConfig.embedded === true && !stripePage ? { embedded: true } : {}),
    // Stripes kürzeres Formular (Daniel, 26. Nov 2026: Bezahlknopf direkt sichtbar). ?kasse=seite zeigt zum Vergleich die bisherige Stripe-Seite.
    ...(publicConfig.form === true && !stripePage && !/[?&]kasse=seite\b/u.test(location.search) ? { form: true } : {}),
    ...(publicConfig.walletEmail === true && !options.email ? { emailLater: true } : {}),
    ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}),
    // Seite im Probewochen-Modus (?preis=probe): der Server gibt Monat und Jahr dann ohne Gratis-Tage.
    ...(options.preis === "probe" ? { preis: "probe" } : {}),
    // Englische Seiten (28. Nov 2026): Stripe-Seite, Erfolgsseite und Vertragsmail auf Englisch. Ältere Server ignorieren das Feld.
    ...(EN ? { locale: "en" } : {}) };
}
function sessionFor(options, user, token) {
  const meta = window.DemenzConsent?.metaContext?.()?.meta?.consent === true;
  const key = JSON.stringify([user.uid, options.plan, options.preis || "", options.email || "", options.offer || null, options.source || "", options.campaign || "", meta, toStripePage(options)]);
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
  const loading = el("p", { class: "kasse-loading", role: "status", text: t("Die sichere Zahlung wird geöffnet …", "Opening secure payment …") });
  let loadingTimer = null;
  const title = el("h2", { id: "kasse-title", tabindex: "-1", text: options.plan === "yearly" ? t("Jahresplan starten", "Start yearly plan") : options.plan === "probe" ? t("Probewoche starten", "Start trial week") : t("Monatsplan starten", "Start monthly plan") });
  const card = el("div", { class: "kasse-card" }, [
    el("div", { class: "kasse-head" }, [title, el("button", { type: "button", class: "kasse-close", "aria-label": t("Schließen", "Close"), text: "×", onclick: () => close() })]),
    error,
    loading
  ]);
  // Daniel, 26. Nov 2026: ein Klick neben die Kasse schließt sie nicht mehr (versehentlich weggeklickt). Schließen nur über das ×.
  const node = el("div", { class: "kasse", role: "dialog", "aria-modal": "true", "aria-labelledby": "kasse-title" }, card);
  const onKey = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  sheet = { node, plan: options.plan, email: options.email, source: options.source, track: options.track, pending: true,
    detach: () => { clearTimeout(loadingTimer); document.removeEventListener("keydown", onKey); },
    onClose: () => { clearTimeout(loadingTimer); document.removeEventListener("keydown", onKey); options.onClose?.(); } };
  document.body.append(node);
  document.body.classList.add("start-noscroll");
  title.focus();
  loadingTimer = setTimeout(() => {
    if (sheet?.node === node && !loading.hidden) loading.textContent = t("Das Laden dauert länger. Du kannst die Kasse schließen und erneut öffnen.", "This is taking longer. You can close the payment window and open it again.");
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
      loading.textContent = t("Weiter zur sicheren Zahlung bei Stripe …", "Continuing to secure payment with Stripe …");
      const session = await sessionFor(options, user, token);
      if (!requireCurrentAccount()) return;
      if (session?.checkoutMode === "embedded" || session?.checkoutMode === "form") {
        // Stripes eigene Zahlungsseite im obersten Layer. Dieses Fenster (Ladehinweis) verschwindet leise, ohne onClose.
        sheet.detach();
        sheet.node.remove();
        sheet = null;
        document.body.classList.remove("start-noscroll"); // das Layer sperrt das Scrollen selbst und gibt es beim Schließen wieder frei
        await showEmbeddedCheckout({ session, publishableKey: publicConfig.publishableKey, title: title.textContent, terms: termsFor(session),
          onClose: () => { options.onClose?.(); offerLater(options); }, onRetry: () => { preparedSessions.clear(); open({ ...options }); },
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
        loading.textContent = t("Die Verbindung ist langsam. Ich versuche es noch einmal …", "The connection is slow. Trying again …");
        await wait(1500 * (tries + 1));
        if (sheet?.node !== node) return;
      }
    }
  } catch (problem) {
    clearTimeout(loadingTimer);
    loading.hidden = true;
    if (!sheet || sheet.node !== node) return;
    if (problem.code === "checkout_account_changed") {
      fail(t("Dein Konto hat sich geändert. Öffne die Zahlung für dein aktuelles Konto erneut.", "Your account has changed. Please open the payment again for your current account."));
      card.append(el("button", { type: "button", class: "abo-button", text: t("Erneut versuchen", "Try again"),
        onclick: () => { if (sheet?.node === node) open({ ...options, email: auth?.currentUser?.email || undefined }); } }));
      return;
    }
    if (problem.code === "already_subscribed") {
      card.append(el("p", { text: t("Du hast schon ein Abo. Dein Plan ist freigeschaltet.", "You already have a subscription. Your plan is unlocked.") }), el("a", { class: "abo-button", href: "/abo/mein-plan.html", text: t("Zu deinem Plan", "Go to your plan") }));
      return;
    }
    if (problem.code === "offer_expired" || problem.code === "invalid_offer") {
      close();
      return options.onOfferExpired?.();
    }
    if (problem.code === "email_required") return fail(t("Bitte gib deine E-Mail-Adresse ein. Geh dafür einen Schritt zurück.", "Please enter your email address. Go back one step to do this."));
    if (problem.code === "terms_outdated") return fail(t("Die Seite ist nicht mehr aktuell. Bitte lade sie neu.", "This page is out of date. Please reload it."));
    options.track?.("checkout_load_failed");
    fail(isTransient(problem)
      ? t("Die Zahlung konnte nicht geladen werden. Das liegt meist an der Internetverbindung. Du hast nichts bezahlt.", "The payment could not load. This is usually the internet connection. You have not paid anything.")
      : t("Die Zahlung kann gerade nicht starten. Du hast nichts bezahlt. Bitte versuch es noch einmal.", "The payment cannot start right now. You have not paid anything. Please try again."));
    card.append(
      el("button", { type: "button", class: "abo-button", text: t("Erneut versuchen", "Try again"), onclick: () => { if (sheet?.node === node) open(options); } }),
      el("a", { class: "kasse-help", href: EN ? "/contact-en.html" : "/kontakt.html", text: t("Klappt es nicht? Schreib uns, wir helfen sofort.", "Not working? Write to us, we’ll help right away.") })
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
    key = `${user.uid}|${options.plan}|${options.preis ?? ""}|${options.offer?.kind ?? ""}|${options.email ?? ""}`;
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
            ...measureFields(),
            ...(publicConfig.walletEmail === true && !options.email ? { emailLater: true } : {}),
            ...(options.offer ? { offer: options.offer } : {}), ...(options.email ? { email: options.email } : {}),
            ...(options.preis === "probe" ? { preis: "probe" } : {}),
            ...(EN ? { locale: "en" } : {}) }
        });
        if (!session.clientSecret) throw new Error("no_client_secret");
        return session.clientSecret;
      })());
      quickSessions.get(key).catch(() => quickSessions.delete(key));
    }
    const clientSecret = await quickSessions.get(key);
    await loadStripeScript();
    const stripe = window.Stripe(publicConfig.publishableKey, { locale: EN ? "en" : "de" });
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
    // Tipp auf Stripes Apple-Pay-Knopf (iframe): Der Fokus wandert ins iframe, das Fenster verliert ihn. Nur für die Messung.
    const onBlur = () => { if (document.body.contains(slot) && slot.contains(document.activeElement)) options.track?.("apple_pay_quick_tap"); };
    window.addEventListener("blur", onBlur);
    express.mount(slot);
    return await visible;
  } catch (problem) {
    quickSessions.delete(key);
    options.onUnavailable?.(problem);
    return false;
  }
}

// --- „Später weitermachen“ nach Kassen-Abbruch (27. Nov 2026, Hebel K6) ------------------------------------------------
// Wer die Kasse ohne Kauf schließt (× im Layer, Zurück von Stripes Seite), bekommt einmal das Angebot, den Link zum Plan per
// E-Mail zu bekommen. Diese Mail ist angefordert. Eine Erinnerung am nächsten Tag kommt nur mit dem eigenen, leeren Häkchen
// (Einwilligung, § 7 UWG); Stripe kann das in Deutschland nicht. Höchstens alle 3 Tage, nach dem Senden nie wieder.
// Server: backend/web-checkout-reminder.mjs (Route /reminder). Ohne reminderMail in /config erscheint nichts.
const LATER_KEY = "demenzCoachLater.v1";
const LATER_PAUSE_MS = 3 * 24 * 60 * 60_000;
function laterBlocked() {
  try {
    const value = JSON.parse(localStorage.getItem(LATER_KEY) || "null");
    return Boolean(value && (value.sent || Date.now() - Number(value.at) < LATER_PAUSE_MS));
  } catch { return false; }
}
function rememberLater(sent) { try { localStorage.setItem(LATER_KEY, JSON.stringify({ at: Date.now(), sent: Boolean(sent) })); } catch { /* privater Modus */ } }
function knownEmail(options) {
  const valid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(String(value || "")) ? String(value) : "";
  let stored = "";
  try { stored = sessionStorage.getItem("demenzCoachEmail") || ""; } catch { /* */ }
  return valid(options?.email) || valid(auth?.currentUser?.email) || valid(stored);
}
const LATER_STYLE = `
.dc-later{border:0;padding:0;background:transparent;max-width:none;max-height:none;width:100%;height:100%;inset:0;margin:0;outline:none}
.dc-later::backdrop{background:rgba(28,27,31,.32)}
.dc-later-wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.dc-later-card{position:relative;width:100%;max-width:460px;background:#fffdf9;border-radius:20px;padding:30px 24px 22px;box-sizing:border-box;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1c1b1f;box-shadow:0 18px 50px rgba(28,27,31,.18)}
.dc-later-card h2{font-size:25px;line-height:1.25;margin:0 36px 12px 0;font-weight:750;outline:none}
.dc-later-close:focus:not(:focus-visible),.dc-later-no:focus:not(:focus-visible),.dc-later-send:focus:not(:focus-visible){outline:none}
.dc-later-card p{font-size:18px;line-height:1.5;margin:0 0 16px}
.dc-later-close{position:absolute;top:12px;right:12px;width:44px;height:44px;border:0;border-radius:50%;background:#f1eee8;color:#1c1b1f;font-size:26px;line-height:1;cursor:pointer}
.dc-later-label{display:block;font-size:16px;font-weight:600;margin:0 0 6px}
.dc-later-input{width:100%;box-sizing:border-box;font-size:19px;padding:14px 16px;border:2px solid #d9d4cc;border-radius:14px;background:#fff;color:#1c1b1f;outline:none}
.dc-later-input:focus{border-color:#47408c}
.dc-later-check{display:flex;gap:12px;align-items:flex-start;margin:16px 0 4px;font-size:17px;line-height:1.45;font-weight:500;cursor:pointer}
.dc-later-check input{width:24px;height:24px;margin:1px 0 0;flex:none;accent-color:#47408c}
.dc-later-send{display:block;width:100%;margin:20px 0 8px;border:0;border-radius:999px;background:#47408c;color:#fff;font-size:19px;font-weight:700;padding:17px 20px;cursor:pointer}
.dc-later-send[disabled]{opacity:.6}
.dc-later-no{display:block;margin:0 auto;border:0;background:none;color:#5b5666;font-size:17px;text-decoration:underline;padding:10px;cursor:pointer}
.dc-later-small{font-size:14px!important;line-height:1.45!important;color:#6b6676;margin:12px 0 0!important}
.dc-later-small a{color:#47408c}
.dc-later-error{color:#a3262a;font-size:16px!important;margin:10px 0 0!important}
`;
let laterOpen = false;
// offerLater({ plan, email, source, track }) → zeigt das Angebot, wenn der Server es anbietet und es nicht gesperrt ist.
export async function offerLater(options = {}) {
  // Die Mail „Später weitermachen“ ist nur auf Deutsch. Englische Seiten bieten sie darum (noch) nicht an.
  if (EN || laterOpen || laterBlocked() || !config.endpoint) return false;
  let loaded;
  try { loaded = await loadConfig(); } catch { return false; }
  const offer = loaded?.reminderMail;
  if (!offer?.consentVersion || laterOpen) return false;
  laterOpen = true;
  rememberLater(false);
  const host = hostWindow();
  const doc = host.document;
  if (!doc.getElementById("dc-later-style")) {
    const style = doc.createElement("style");
    style.id = "dc-later-style"; style.textContent = LATER_STYLE;
    doc.head.append(style);
  }
  const make = (tag, props = {}, text) => { const node = doc.createElement(tag); for (const [key, value] of Object.entries(props)) node.setAttribute(key, value); if (text) node.textContent = text; return node; };
  const dialog = make("dialog", { class: "dc-later", "aria-labelledby": "dc-later-title" });
  const card = make("div", { class: "dc-later-card" });
  const closeButton = make("button", { type: "button", class: "dc-later-close", "aria-label": "Schließen" }, "×");
  const form = make("form", { novalidate: "" });
  const input = make("input", { class: "dc-later-input", id: "dc-later-email", type: "email", inputmode: "email", autocomplete: "email", placeholder: "name@beispiel.de", required: "" });
  input.value = knownEmail(options);
  const tick = make("input", { type: "checkbox", id: "dc-later-tick" });
  const check = make("label", { class: "dc-later-check", for: "dc-later-tick" });
  check.append(tick, make("span", {}, offer.consentText));
  const send = make("button", { type: "submit", class: "dc-later-send" }, "Link schicken");
  const no = make("button", { type: "button", class: "dc-later-no" }, "Nein danke");
  const error = make("p", { class: "dc-later-error", role: "alert", hidden: "" });
  const small = make("p", { class: "dc-later-small" }, "Kein Newsletter. Wir nutzen deine Adresse nur für diese E-Mail und, wenn du es ankreuzt, für eine Erinnerung. ");
  const privacy = make("a", { href: "/datenschutz.html#spaeter", target: "_blank", rel: "noopener" }, "Datenschutz");
  small.append(privacy);
  form.append(make("label", { class: "dc-later-label", for: "dc-later-email" }, "Deine E-Mail-Adresse"), input, check, error, send, no, small);
  const heading = make("h2", { id: "dc-later-title", tabindex: "-1" }, "Später in Ruhe weitermachen?");
  input.addEventListener("input", () => { error.hidden = true; });
  card.append(closeButton, heading,
    make("p", {}, "Wir schicken dir den Link zu deinem Plan per E-Mail. Dann findest du ihn sofort wieder."), form);
  const wrap = make("div", { class: "dc-later-wrap" });
  wrap.append(card);
  dialog.append(wrap);
  const finish = () => { laterOpen = false; try { if (dialog.open) dialog.close(); } catch { /* */ } dialog.remove(); };
  closeButton.addEventListener("click", () => { options.track?.("later_closed"); finish(); });
  no.addEventListener("click", () => { options.track?.("later_no"); finish(); });
  // Schließen nur über × oder „Nein danke“ (Daniel: Layer schließen nur per X); Esc bleibt erlaubt.
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) { error.textContent = "Bitte gib eine gültige E-Mail-Adresse ein."; error.hidden = false; input.focus(); return; }
    send.disabled = true;
    send.textContent = "Wird gesendet …";
    try {
      const user = await signedInUser();
      const token = await user.getIdToken();
      const result = await api("/reminder", { method: "POST", token, body: { email, plan: options.plan === "monthly" || options.plan === "probe" ? "monthly" : "yearly",
        source: options.source, followUp: tick.checked, ...(tick.checked ? { consentVersion: offer.consentVersion } : {}) } });
      rememberLater(true);
      options.track?.(tick.checked ? "later_sent_reminder" : "later_sent");
      card.replaceChildren(closeButton, make("h2", { id: "dc-later-title" }, result?.reason === "already_subscribed" ? "Du hast schon ein Abo" : "Gesendet"),
        make("p", {}, result?.reason === "already_subscribed"
          ? "Dein Plan ist schon freigeschaltet. Du findest ihn unter „Mein Plan“."
          : "Schau gleich in dein Postfach. Kommt nichts an? Sieh bitte auch im Spam-Ordner nach."));
      const done = make("button", { type: "button", class: "dc-later-send" }, "Schließen");
      done.addEventListener("click", finish);
      card.append(done);
    } catch {
      send.disabled = false;
      send.textContent = "Link schicken";
      error.textContent = "Das hat nicht geklappt. Bitte versuch es gleich noch einmal.";
      error.hidden = false;
    }
  });
  doc.body.append(dialog);
  try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
  // Fokus auf die Überschrift, nicht aufs × (kein Fokusrahmen beim Öffnen, Daniel).
  heading.focus({ preventScroll: true });
  options.track?.("later_shown");
  return true;
}

// Zurück von Stripes Seite: Der Browser zeigt die alte Seite samt Ladefenster wieder an, darum schließen wir es.
// Danach einmal „Später weitermachen“ anbieten (wer bezahlt hat, landet nicht hier, sondern auf der Erfolgsseite).
window.addEventListener("pageshow", (event) => {
  if (!(event.persisted && sheet?.redirected)) return;
  const last = { plan: sheet.plan, email: sheet.email, source: sheet.source, track: sheet.track };
  close();
  offerLater(last);
});
// Stripes Zurück-Link (cancel_url /abo/?status=abgebrochen) kommt über /abo/ mit zurueck=1 hierher.
if (window.top === window && /[?&]zurueck=1\b/u.test(location.search)) {
  const params = new URLSearchParams(location.search);
  params.delete("zurueck");
  try { history.replaceState(history.state, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`); } catch { /* */ }
  setTimeout(() => offerLater({ plan: params.get("plan") === "monthly" ? "monthly" : "yearly", source: "stripe_zurueck" }), 900);
}

export const isOpen = () => Boolean(sheet || embedded);
window.DemenzKasse = Object.freeze({ open, close, isOpen, mountApplePay, prepare, offerLater });
