// Stripes eingebettete Zahlungsseite im obersten Layer (Daniel, 26. Nov 2026: die Zahlung kommt immer im Layer, kein eigenes
// Formular, keine Weiterleitung). Das ist Stripes eigene Seite (ui_mode embedded_page), die in diesem Dokument erscheint.
// Läuft die Kasse im Rahmen des Quiz-Layers (iframe), wird die Seite im Eltern-Dokument gezeigt: Stripe lässt sich nicht
// zuverlässig in einem Rahmen laden. Der Layer ist ein <dialog> (showModal), damit er über dem Quiz-Layer liegt.
const STRIPE_SRC = "https://js.stripe.com/dahlia/stripe.js";
const LOAD_LIMIT_MS = 15_000;

export function hostWindow() {
  try { if (window.top !== window && window.top.document && window.top.location.origin === window.location.origin) return window.top; } catch { /* anderer Ursprung */ }
  return window;
}

export function loadStripe(host = hostWindow()) {
  if (host.Stripe) return Promise.resolve();
  if (host.__dcStripeLoading) return host.__dcStripeLoading;
  host.__dcStripeLoading = new Promise((resolve, reject) => {
    const script = host.document.createElement("script");
    script.src = STRIPE_SRC;
    script.onload = resolve;
    script.onerror = () => { host.__dcStripeLoading = null; reject(new Error("stripe.js failed")); };
    host.document.head.append(script);
  });
  return host.__dcStripeLoading;
}

function ensureStyle(doc) {
  if (doc.getElementById("dc-kasse-style")) return;
  const link = doc.createElement("link");
  link.id = "dc-kasse-style"; link.rel = "stylesheet"; link.href = "/abo/kasse.css";
  doc.head.append(link);
}

// showEmbeddedCheckout({ host, session, publishableKey, title, terms, onClose, onRetry, onOpen, onDispose, track }) → { close }
// session.checkoutMode "form": Stripes kürzeres Formular (ui_mode form). Es zeigt keine eigenen Texte. Preis, Laufzeit und
// Kündigung (terms) stehen klein direkt unter Stripes Kaufknopf, darunter die Links (Daniel, 27. Nov 2026: „Es soll KEIN Text
// darüber angezeigt werden. Wenn darunter, in klein! Der Kaufbutton soll direkt sichtbar sein.“).
// onOpen({ close }) kommt sofort, wenn das Fenster steht (noch vor dem Laden von Stripe), onDispose, sobald es weg ist (×, Esc, Zurück, Wiederholen).
export async function showEmbeddedCheckout({ host = hostWindow(), session, publishableKey, title, terms, onClose, onRetry, onOpen, onDispose, track }) {
  const doc = host.document;
  if (doc.querySelector("dialog.kasse-embed")) return { close() {} }; // schon offen (Doppeltipp)
  ensureStyle(doc);
  const make = (tag, props = {}, text) => { const node = doc.createElement(tag); for (const [key, value] of Object.entries(props)) node.setAttribute(key, value); if (text) node.textContent = text; return node; };
  const dialog = make("dialog", { class: "kasse-embed", "aria-labelledby": "kasse-embed-title" });
  const en = /^en(?:-|$)/iu.test(doc.documentElement.lang || "");
  const closeButton = make("button", { type: "button", class: "kasse-embed-close", "aria-label": en ? "Close" : "Schließen" }, "×");
  const heading = make("h2", { id: "kasse-embed-title", tabindex: "-1" }, title);
  const status = make("p", { class: "kasse-embed-status", role: "status" }, en ? "Loading secure payment …" : "Die sichere Zahlung wird geladen …");
  const problem = make("div", { class: "kasse-embed-problem", hidden: "", role: "alert" });
  const box = make("div", { class: "kasse-embed-box" });
  // Daniel, 26. Nov 2026: kein sichtbarer Titel über Stripe, damit der Bezahlknopf möglichst ohne Scrollen sichtbar ist.
  // Der Titel bleibt nur für Screenreader; das × schwebt oben rechts.
  heading.className = "kasse-embed-sr";
  // Kein Scrollen im Fenster (Daniel, 26. Nov 2026): Das Fenster wächst mit Stripe, gescrollt wird die ganze Fläche.
  const isForm = session?.checkoutMode === "form";
  const panel = make("div", { class: isForm ? "kasse-embed-panel kasse-embed-form" : "kasse-embed-panel" });
  if (isForm) {
    const base = "https://dementiacoachapp.com";
    const intro = make("p", { class: "kasse-embed-terms" }, terms || "");
    const links = make("p", { class: "kasse-embed-links" });
    links.append(en ? "Cancel online, no login needed: " : "Online kündbar, ohne Anmeldung: ");
    const linkList = en
      ? [["/abo/kuendigen.html", "Cancel contracts here"], ["https://billing.stripe.com/p/login/dRmbJ17QQ8TP85s79Z1ZS00", "Manage subscription"], ["/terms-en.html#abo-web", "30-day money-back guarantee"],
        ["/terms-en.html", "Terms of Use"], ["/terms-en.html#abo-web", "Right of withdrawal"], ["/privacy-en.html", "Privacy"]]
      : [["/abo/kuendigen.html", "Verträge hier kündigen"], ["https://billing.stripe.com/p/login/dRmbJ17QQ8TP85s79Z1ZS00", "Abo verwalten"], ["/abo/garantie.html", "30 Tage Geld-zurück-Garantie"],
        ["/nutzungsbedingungen.html", "Nutzungsbedingungen"], ["/abo/widerruf.html", "Widerrufsbelehrung"], ["/datenschutz.html", "Datenschutz"]];
    for (const [index, [href, text]] of linkList.entries()) {
      if (index) links.append(" · ");
      links.append(make("a", { href: href.startsWith("https:") ? href : base + href, target: "_blank", rel: "noopener" }, text));
    }
    panel.append(heading, closeButton, status, problem, box, intro, links);
  } else {
    panel.append(heading, closeButton, status, problem, box);
  }
  dialog.append(panel);
  const root = doc.documentElement, body = doc.body, overflow = [root.style.overflow, body.style.overflow];
  let finished = false, checkout = null, watchdog = null;
  const dispose = () => {
    if (finished) return false;
    finished = true;
    clearTimeout(watchdog);
    try { checkout?.destroy?.(); } catch { /* schon weg */ }
    try { if (dialog.open) dialog.close(); } catch { /* */ }
    dialog.remove();
    root.style.overflow = overflow[0]; body.style.overflow = overflow[1];
    try { onDispose?.(); } catch { /* */ }
    return true;
  };
  const close = () => { if (dispose()) onClose?.(); };
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  // Ein Klick neben die Zahlung schließt sie nicht (Daniel, 26. Nov 2026). Schließen nur über das × oder Esc.
  body.append(dialog);
  root.style.overflow = "hidden"; body.style.overflow = "hidden";
  try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
  heading.focus({ preventScroll: true });
  try { onOpen?.({ close }); } catch { /* */ }

  const fail = (message) => {
    if (finished) return;
    clearTimeout(watchdog);
    status.hidden = true;
    problem.hidden = false;
    problem.replaceChildren(make("p", { class: "abo-error" }, message));
    const retry = make("button", { type: "button", class: "abo-button" }, en ? "Try again" : "Erneut versuchen");
    retry.addEventListener("click", () => { if (dispose()) onRetry?.(); });
    const help = make("a", { class: "kasse-help", href: en ? "/contact-en.html" : "/kontakt.html" }, en ? "Not working? Write to us, we’ll help right away." : "Klappt es nicht? Schreib uns, wir helfen sofort.");
    problem.append(retry, help);
    track?.("checkout_embedded_failed");
  };

  // Stripes Formular: zuerst „compact“ (Schritte, Vorabversion bei Stripe), ohne Freischaltung sofort „expanded“.
  const mountForm = async (stripe) => {
    if (typeof stripe.initCheckoutFormSdk !== "function") throw new Error("form_unsupported");
    const sdk = stripe.initCheckoutFormSdk({ clientSecret: session.clientSecret,
      appearance: { variables: { colorPrimary: "#47408c", colorBackground: "#ffffff", colorText: "#1c1b1f", borderRadius: "12px", fontSizeBase: "17px" } } });
    const attach = (layout) => new Promise((resolve) => {
      setTimeout(() => resolve(null), LOAD_LIMIT_MS); // nie endlos warten
      const slot = make("div", { class: "kasse-embed-slot" });
      box.replaceChildren(slot);
      const form = sdk.createForm({ layout, expressCheckout: { buttonHeight: 52 } });
      form.on("ready", () => resolve(form));
      form.on("loaderror", () => resolve(null));
      form.mount(slot);
    });
    const form = (await attach("compact")) || (await attach("expanded"));
    if (!form) throw new Error("form_failed");
    if (finished) return;
    track?.(`checkout_form_${box.querySelector("iframe") ? "ready" : "empty"}`);
    const loaded = await sdk.loadActions();
    if (loaded?.type !== "success") throw new Error("form_actions");
    form.on("confirm", (event) => {
      loaded.actions.confirm({ formConfirmEvent: event }).catch(() => { /* Stripe zeigt den Fehler selbst im Formular */ });
    });
  };

  try {
    await loadStripe(host);
    const stripe = en ? host.Stripe(publishableKey, { locale: "en" }) : host.Stripe(publishableKey);
    if (isForm) {
      await mountForm(stripe);
    } else {
      const create = stripe.createEmbeddedCheckoutPage || stripe.initEmbeddedCheckout;
      if (typeof create !== "function") throw new Error("embedded_unsupported");
      checkout = await create.call(stripe, { fetchClientSecret: async () => session.clientSecret });
      if (finished) { try { checkout.destroy?.(); } catch { /* */ } return { close }; }
      checkout.mount(box);
    }
    // Wächter: nie endlos laden. Sobald Stripes Rahmen da ist, lädt Stripe selbst weiter (eigenes Skelett). Ein „load“-Ereignis
    // des Rahmens kommt nicht immer bei uns an (26. Nov 2026: falsche Fehlermeldung über einer fertigen Kasse). Fehler nur, wenn
    // nach 15 Sekunden gar kein Rahmen erschienen ist.
    const started = Date.now();
    const poll = () => {
      if (finished) return;
      if (box.querySelector("iframe")) { status.hidden = true; track?.("checkout_embedded_ready"); return; }
      if (Date.now() - started > LOAD_LIMIT_MS) return fail(en ? "The payment could not load. This is usually the internet connection. You have not paid anything." : "Die Zahlung konnte nicht geladen werden. Das liegt meist an der Internetverbindung. Du hast nichts bezahlt.");
      watchdog = setTimeout(poll, 100);
    };
    poll();
  } catch {
    fail(en ? "The payment could not load. This is usually the internet connection. You have not paid anything." : "Die Zahlung konnte nicht geladen werden. Das liegt meist an der Internetverbindung. Du hast nichts bezahlt.");
  }
  return { close };
}
