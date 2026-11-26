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

// showEmbeddedCheckout({ host, session, publishableKey, title, onClose, onRetry, onOpen, onDispose, track }) → { close }
// onOpen({ close }) kommt sofort, wenn das Fenster steht (noch vor dem Laden von Stripe), onDispose, sobald es weg ist (×, Esc, Zurück, Wiederholen).
export async function showEmbeddedCheckout({ host = hostWindow(), session, publishableKey, title, onClose, onRetry, onOpen, onDispose, track }) {
  const doc = host.document;
  if (doc.querySelector("dialog.kasse-embed")) return { close() {} }; // schon offen (Doppeltipp)
  ensureStyle(doc);
  const make = (tag, props = {}, text) => { const node = doc.createElement(tag); for (const [key, value] of Object.entries(props)) node.setAttribute(key, value); if (text) node.textContent = text; return node; };
  const dialog = make("dialog", { class: "kasse-embed", "aria-labelledby": "kasse-embed-title" });
  const closeButton = make("button", { type: "button", class: "kasse-embed-close", "aria-label": "Schließen" }, "×");
  const heading = make("h2", { id: "kasse-embed-title", tabindex: "-1" }, title);
  const status = make("p", { class: "kasse-embed-status", role: "status" }, "Die sichere Zahlung wird geladen …");
  const problem = make("div", { class: "kasse-embed-problem", hidden: "", role: "alert" });
  const box = make("div", { class: "kasse-embed-box" });
  dialog.append(make("div", { class: "kasse-embed-head" }), status, problem, box);
  dialog.firstChild.append(heading, closeButton);
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
    const retry = make("button", { type: "button", class: "abo-button" }, "Erneut versuchen");
    retry.addEventListener("click", () => { if (dispose()) onRetry?.(); });
    const help = make("a", { class: "kasse-help", href: "/kontakt.html" }, "Klappt es nicht? Schreib uns, wir helfen sofort.");
    problem.append(retry, help);
    track?.("checkout_embedded_failed");
  };

  try {
    await loadStripe(host);
    const stripe = host.Stripe(publishableKey);
    const create = stripe.createEmbeddedCheckoutPage || stripe.initEmbeddedCheckout;
    if (typeof create !== "function") throw new Error("embedded_unsupported");
    checkout = await create.call(stripe, { fetchClientSecret: async () => session.clientSecret });
    if (finished) { try { checkout.destroy?.(); } catch { /* */ } return { close }; }
    checkout.mount(box);
    // Wächter: nie endlos laden. Erscheint Stripes Rahmen nicht oder lädt er nicht fertig, kommt die Meldung mit „Erneut versuchen“.
    let loaded = false;
    const started = Date.now();
    const poll = () => {
      if (finished || loaded) return;
      const frame = box.querySelector("iframe");
      if (frame && !frame.__dcWatched) {
        frame.__dcWatched = true;
        frame.addEventListener("load", () => { loaded = true; status.hidden = true; track?.("checkout_embedded_ready"); });
      }
      if (Date.now() - started > LOAD_LIMIT_MS) return fail("Die Zahlung konnte nicht geladen werden. Das liegt meist an der Internetverbindung. Du hast nichts bezahlt.");
      watchdog = setTimeout(poll, 300);
    };
    poll();
  } catch {
    fail("Die Zahlung konnte nicht geladen werden. Das liegt meist an der Internetverbindung. Du hast nichts bezahlt.");
  }
  return { close };
}
